import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const cronSecret = Deno.env.get("CRON_SECRET") || "";
const reminderFromEmail =
  Deno.env.get("TRIAL_REMINDER_FROM_EMAIL") || "Pillaflow <noreply@pillaflow.com>";

const retryHours = (() => {
  const parsed = Number(Deno.env.get("TRIAL_REMINDER_RETRY_HOURS") || "12");
  if (!Number.isFinite(parsed) || parsed <= 0) return 12;
  return Math.round(parsed);
})();

const maxBatchSize = (() => {
  const parsed = Number(Deno.env.get("TRIAL_REMINDER_MAX_BATCH_SIZE") || "100");
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(500, Math.round(parsed));
})();

const profileSelect = "*";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeString = (value: unknown) => String(value || "").trim();
const normalizeEmail = (value: unknown) => normalizeString(value).toLowerCase();

const uniqueStrings = (values: unknown[]) =>
  Array.from(new Set(values.map(normalizeString).filter(Boolean)));

const isMissingColumnError = (error: any, column: string) => {
  if (!error) return false;
  const combined = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`
    .toLowerCase();
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    combined.includes("does not exist") ||
    combined.includes(`column ${column}`) ||
    combined.includes(`'${column}'`) ||
    combined.includes(`"${column}"`)
  );
};

const summarizeHttpBody = (body: string) =>
  String(body || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatTrialEndsAt = (trialEndsAtIso: string) => {
  const date = new Date(trialEndsAtIso);
  if (Number.isNaN(date.getTime())) return trialEndsAtIso;

  try {
    return `${new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date)} UTC`;
  } catch {
    return date.toISOString();
  }
};

const getPlanLabel = (productId: string) => {
  const normalized = normalizeString(productId).toLowerCase();
  if (normalized.includes("year") || normalized.includes("annual")) return "yearly";
  if (normalized.includes("month")) return "monthly";
  return "Premium";
};

const getProfilesByUserIds = async (userIds: string[]) => {
  const profileMap = new Map<string, Record<string, unknown>>();
  if (!userIds.length) return profileMap;

  const tryLookup = async (column: "id" | "user_id", ids: string[]) => {
    const { data, error } = await adminClient
      .from("profiles")
      .select(profileSelect)
      .in(column, ids);

    if (error && isMissingColumnError(error, column)) {
      return { rows: [] as Record<string, unknown>[], error: null };
    }

    return {
      rows: (data || []) as Record<string, unknown>[],
      error,
    };
  };

  const byId = await tryLookup("id", userIds);
  if (byId.error) throw byId.error;
  byId.rows.forEach((row) => {
    const key = normalizeString(row.id);
    if (key) profileMap.set(key, row);
  });

  const remainingIds = userIds.filter((userId) => !profileMap.has(userId));
  if (!remainingIds.length) return profileMap;

  const byUserId = await tryLookup("user_id", remainingIds);
  if (byUserId.error) throw byUserId.error;
  byUserId.rows.forEach((row) => {
    const key = normalizeString(row.user_id);
    if (key) profileMap.set(key, row);
  });

  return profileMap;
};

const sendTrialEndingEmail = async (
  email: string,
  trialEndsAtIso: string,
  productId: string,
) => {
  const planLabel = getPlanLabel(productId);
  const endsAtLabel = formatTrialEndsAt(trialEndsAtIso);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: reminderFromEmail,
      to: [email],
      subject: "Your Pillaflow Premium trial ends in 3 days",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="margin-bottom:12px;">Your Premium trial ends soon</h2>
          <p>Your Pillaflow Premium ${escapeHtml(planLabel)} trial ends on <strong>${escapeHtml(endsAtLabel)}</strong>.</p>
          <p>If you want to keep Premium, you do not need to do anything.</p>
          <p>If you do not want the paid subscription to begin, cancel before your trial ends in your App Store or Google Play subscription settings.</p>
          <p>Thanks for trying Pillaflow Premium.</p>
        </div>
      `,
      text:
        `Your Pillaflow Premium ${planLabel} trial ends on ${endsAtLabel}.\n\n` +
        `If you want to keep Premium, you do not need to do anything.\n` +
        `If you do not want the paid subscription to begin, cancel before your trial ends in your App Store or Google Play subscription settings.`,
    }),
  });

  const contentType = response.headers.get("content-type") || "";
  const rawBody = await response.text();
  let payload: Record<string, unknown> = {};

  if (contentType.toLowerCase().includes("application/json")) {
    try {
      payload = JSON.parse(rawBody || "{}");
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const payloadMessage = payload["message"];
    const payloadError = payload["error"];
    const payloadName = payload["name"];
    const payloadSummary =
      (typeof payloadMessage === "string" && payloadMessage.trim()) ||
      (typeof payloadError === "string" && payloadError.trim()) ||
      (typeof payloadName === "string" && payloadName.trim()) ||
      "";

    throw new Error(
      String(
        payloadSummary ||
          summarizeHttpBody(rawBody) ||
          `Resend request failed with status ${response.status}.`,
      ),
    );
  }

  return payload;
};

const updateReminderDeliveryState = async (
  reminderId: string,
  updates: Record<string, unknown>,
) => {
  const { error } = await adminClient
    .from("premium_trial_reminders")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reminderId);

  if (error) throw error;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !supabaseServiceRoleKey || !resendApiKey || !cronSecret) {
    return jsonResponse({ error: "Missing server configuration." }, 500);
  }

  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (cronHeader !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const retryCutoffMs = now.getTime() - retryHours * 60 * 60 * 1000;

    const { data, error } = await adminClient
      .from("premium_trial_reminders")
      .select(
        "id, user_id, app_user_id, product_id, trial_ends_at, reminder_due_at, last_delivery_attempt_at",
      )
      .lte("reminder_due_at", nowIso)
      .gt("trial_ends_at", nowIso)
      .is("sent_at", null)
      .is("cancelled_at", null)
      .is("converted_at", null)
      .is("expired_at", null)
      .order("reminder_due_at", { ascending: true })
      .limit(maxBatchSize * 5);

    if (error) {
      return jsonResponse(
        { error: error.message || "Unable to load due reminders." },
        500,
      );
    }

    const dueReminders = (data || [])
      .filter((row) => {
        if (!row?.last_delivery_attempt_at) return true;
        const lastAttemptMs = new Date(row.last_delivery_attempt_at).getTime();
        return Number.isNaN(lastAttemptMs) || lastAttemptMs <= retryCutoffMs;
      })
      .slice(0, maxBatchSize);

    if (!dueReminders.length) {
      return jsonResponse({ ok: true, sent: 0, skipped: 0, failed: 0, processed: 0 });
    }

    const userIds = uniqueStrings(
      dueReminders
        .map((row) => normalizeString(row.user_id) || normalizeString(row.app_user_id))
        .filter((value) => uuidPattern.test(value)),
    );
    const profilesByUserId = await getProfilesByUserIds(userIds);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const reminder of dueReminders) {
      const userId = normalizeString(reminder.user_id) || normalizeString(reminder.app_user_id);
      if (!uuidPattern.test(userId)) {
        skipped += 1;
        await updateReminderDeliveryState(reminder.id, {
          last_delivery_attempt_at: nowIso,
          last_delivery_error: "unresolved user id",
        });
        continue;
      }

      const profile = userId ? profilesByUserId.get(userId) : null;
      const email = normalizeEmail(profile?.email);

      if (!email) {
        skipped += 1;
        await updateReminderDeliveryState(reminder.id, {
          last_delivery_attempt_at: nowIso,
          last_delivery_error: "missing profile email",
        });
        continue;
      }

      if (
        profile &&
        Object.prototype.hasOwnProperty.call(profile, "email_verified") &&
        profile.email_verified === false
      ) {
        skipped += 1;
        await updateReminderDeliveryState(reminder.id, {
          last_delivery_attempt_at: nowIso,
          last_delivery_error: "email not verified",
        });
        continue;
      }

      try {
        await sendTrialEndingEmail(email, reminder.trial_ends_at, reminder.product_id);
        sent += 1;
        await updateReminderDeliveryState(reminder.id, {
          sent_at: nowIso,
          last_delivery_attempt_at: nowIso,
          last_delivery_error: null,
        });
      } catch (sendError: any) {
        failed += 1;
        await updateReminderDeliveryState(reminder.id, {
          last_delivery_attempt_at: nowIso,
          last_delivery_error: String(
            sendError?.message || sendError || "Email send failed.",
          ).slice(0, 500),
        });
      }
    }

    return jsonResponse({
      ok: true,
      processed: dueReminders.length,
      sent,
      skipped,
      failed,
    });
  } catch (error: any) {
    console.error("send-trial-reminders error:", error);
    return jsonResponse(
      { error: String(error?.message || error || "Internal server error") },
      500,
    );
  }
});
