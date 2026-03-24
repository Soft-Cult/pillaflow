import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const webhookAuthorization = Deno.env.get("REVENUECAT_WEBHOOK_AUTHORIZATION") || "";
const premiumEntitlementId =
  (Deno.env.get("REVENUECAT_PREMIUM_ENTITLEMENT_ID") || "premium").trim().toLowerCase();
const includeSandbox = /^(1|true|yes)$/i.test(
  Deno.env.get("TRIAL_REMINDER_INCLUDE_SANDBOX") || "",
);

const reminderLeadDays = (() => {
  const parsed = Number(Deno.env.get("TRIAL_REMINDER_LEAD_DAYS") || "3");
  if (!Number.isFinite(parsed) || parsed < 0) return 3;
  return Math.round(parsed);
})();

const dayMs = 24 * 60 * 60 * 1000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const premiumProductIds = new Set([
  "pillaflow_monthly",
  "pillaflow_yearly",
  "pillaflow1month:monthly",
  "pillaflow1year:yearly",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const normalizeUpper = (value: unknown) => normalizeString(value).toUpperCase();

const uniqueStrings = (values: unknown[]) =>
  Array.from(new Set(values.map(normalizeString).filter(Boolean)));

const toIsoFromMillis = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Date(parsed).toISOString();
};

const getOccurredAtIso = (event: Record<string, unknown>) =>
  toIsoFromMillis(event.event_timestamp_ms) ||
  toIsoFromMillis(event.purchased_at_ms) ||
  new Date().toISOString();

const getTrialEndsAtIso = (event: Record<string, unknown>) => toIsoFromMillis(event.expiration_at_ms);

const getReminderDueAtIso = (trialEndsAtIso: string) => {
  const trialEndsAtMs = new Date(trialEndsAtIso).getTime();
  if (Number.isNaN(trialEndsAtMs)) return null;
  return new Date(trialEndsAtMs - reminderLeadDays * dayMs).toISOString();
};

const getEntitlementIds = (event: Record<string, unknown>) => {
  const rawEntitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
    : [event.entitlement_id];
  return uniqueStrings(rawEntitlementIds).map((value) => value.toLowerCase());
};

const isPremiumEvent = (event: Record<string, unknown>) => {
  const productId = normalizeString(event.product_id).toLowerCase();
  if (productId && premiumProductIds.has(productId)) {
    return true;
  }

  return getEntitlementIds(event).includes(premiumEntitlementId);
};

const isTrialPeriod = (event: Record<string, unknown>) =>
  normalizeUpper(event.period_type) === "TRIAL";

const getResolvedUserId = (event: Record<string, unknown>) => {
  const aliases = Array.isArray(event.aliases) ? event.aliases : [];
  return (
    uniqueStrings([event.app_user_id, event.original_app_user_id, ...aliases]).find((value) =>
      uuidPattern.test(value)
    ) || null
  );
};

const insertWebhookEvent = async (
  event: Record<string, unknown>,
  payload: Record<string, unknown>,
) => {
  const eventId = normalizeString(event.id);
  const eventType = normalizeUpper(event.type) || "UNKNOWN";

  const { data, error } = await adminClient
    .from("revenuecat_webhook_events")
    .upsert(
      {
        event_id: eventId,
        event_type: eventType,
        app_user_id: normalizeString(event.app_user_id) || null,
        original_app_user_id: normalizeString(event.original_app_user_id) || null,
        original_transaction_id: normalizeString(event.original_transaction_id) || null,
        product_id: normalizeString(event.product_id) || null,
        environment: normalizeUpper(event.environment) || null,
        payload,
      },
      {
        onConflict: "event_id",
        ignoreDuplicates: true,
      },
    )
    .select("event_id")
    .maybeSingle();

  if (error) throw error;
  return !!data?.event_id;
};

const findReminderIdForEvent = async (event: Record<string, unknown>) => {
  const originalTransactionId = normalizeString(event.original_transaction_id);
  if (originalTransactionId) {
    const { data, error } = await adminClient
      .from("premium_trial_reminders")
      .select("id")
      .eq("original_transaction_id", originalTransactionId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id as string;
  }

  const appUserId =
    normalizeString(event.app_user_id) || normalizeString(event.original_app_user_id);
  const productId = normalizeString(event.product_id);
  if (!appUserId || !productId) return null;

  const { data, error } = await adminClient
    .from("premium_trial_reminders")
    .select("id")
    .eq("app_user_id", appUserId)
    .eq("product_id", productId)
    .is("expired_at", null)
    .order("trial_ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.id as string | undefined) || null;
};

const upsertTrialReminder = async (
  event: Record<string, unknown>,
  eventId: string,
  eventType: string,
  occurredAtIso: string,
) => {
  const appUserId =
    normalizeString(event.app_user_id) || normalizeString(event.original_app_user_id);
  const productId = normalizeString(event.product_id);
  const trialEndsAtIso = getTrialEndsAtIso(event);
  const reminderDueAtIso = trialEndsAtIso ? getReminderDueAtIso(trialEndsAtIso) : null;

  if (!appUserId || !productId || !trialEndsAtIso || !reminderDueAtIso) {
    return { ok: false, reason: "missing trial payload" };
  }

  const nowIso = new Date().toISOString();
  const originalTransactionId = normalizeString(event.original_transaction_id);
  const payload = {
    user_id: getResolvedUserId(event),
    app_user_id: appUserId,
    original_app_user_id: normalizeString(event.original_app_user_id) || null,
    product_id: productId,
    store: normalizeUpper(event.store) || null,
    environment: normalizeUpper(event.environment) || null,
    original_transaction_id: originalTransactionId || null,
    trial_started_at: toIsoFromMillis(event.purchased_at_ms) || occurredAtIso,
    trial_ends_at: trialEndsAtIso,
    reminder_due_at: reminderDueAtIso,
    sent_at: null,
    cancelled_at: null,
    converted_at: null,
    expired_at: null,
    last_delivery_attempt_at: null,
    last_delivery_error: null,
    last_event_id: eventId,
    last_event_type: eventType,
    last_event_at: occurredAtIso,
    updated_at: nowIso,
  };

  if (originalTransactionId) {
    const { error } = await adminClient
      .from("premium_trial_reminders")
      .upsert(
        payload,
        {
          onConflict: "original_transaction_id",
        },
      );

    if (error) throw error;
    return { ok: true, mode: "original_transaction_id" };
  }

  const { error } = await adminClient
    .from("premium_trial_reminders")
    .upsert(payload, {
      onConflict: "app_user_id,product_id,trial_ends_at",
    });

  if (error) throw error;
  return { ok: true, mode: "fallback" };
};

const updateReminderForEvent = async (
  event: Record<string, unknown>,
  eventId: string,
  eventType: string,
  occurredAtIso: string,
  updates: Record<string, unknown>,
) => {
  const reminderId = await findReminderIdForEvent(event);
  if (!reminderId) return false;

  const { error } = await adminClient
    .from("premium_trial_reminders")
    .update({
      ...updates,
      last_event_id: eventId,
      last_event_type: eventType,
      last_event_at: occurredAtIso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reminderId);

  if (error) throw error;
  return true;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !supabaseServiceRoleKey || !webhookAuthorization) {
    return jsonResponse({ error: "Missing server configuration." }, 500);
  }

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== webhookAuthorization) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await req.json().catch(() => null);
    const event = payload?.event && typeof payload.event === "object"
      ? payload.event as Record<string, unknown>
      : payload && typeof payload === "object"
      ? payload as Record<string, unknown>
      : null;

    if (!event) {
      return jsonResponse({ error: "Missing webhook payload." }, 400);
    }

    const eventId = normalizeString(event.id);
    const eventType = normalizeUpper(event.type);
    if (!eventId || !eventType) {
      return jsonResponse({ error: "Missing RevenueCat event metadata." }, 400);
    }

    const inserted = await insertWebhookEvent(event, payload || {});
    if (!inserted) {
      return jsonResponse({ ok: true, duplicate: true, eventId, eventType });
    }

    if (!isPremiumEvent(event)) {
      return jsonResponse({ ok: true, ignored: true, reason: "non-premium event", eventType });
    }

    const environment = normalizeUpper(event.environment);
    if (!includeSandbox && environment && environment !== "PRODUCTION") {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: "sandbox ignored",
        eventType,
        environment,
      });
    }

    const occurredAtIso = getOccurredAtIso(event);

    switch (eventType) {
      case "INITIAL_PURCHASE":
      case "PRODUCT_CHANGE":
      case "SUBSCRIPTION_EXTENDED": {
        if (!isTrialPeriod(event)) {
          return jsonResponse({ ok: true, ignored: true, reason: "non-trial start", eventType });
        }

        const result = await upsertTrialReminder(event, eventId, eventType, occurredAtIso);
        return jsonResponse({
          ok: true,
          action: result.ok ? "trial-upserted" : "trial-skipped",
          reason: result.ok ? undefined : result.reason,
          eventId,
          eventType,
        });
      }
      case "CANCELLATION": {
        if (!isTrialPeriod(event)) {
          return jsonResponse({
            ok: true,
            ignored: true,
            reason: "non-trial cancellation",
            eventType,
          });
        }

        const updated = await updateReminderForEvent(event, eventId, eventType, occurredAtIso, {
          cancelled_at: occurredAtIso,
        });
        return jsonResponse({ ok: true, action: updated ? "trial-cancelled" : "no-reminder" });
      }
      case "UNCANCELLATION": {
        if (!isTrialPeriod(event)) {
          return jsonResponse({
            ok: true,
            ignored: true,
            reason: "non-trial uncancellation",
            eventType,
          });
        }

        const updated = await updateReminderForEvent(event, eventId, eventType, occurredAtIso, {
          cancelled_at: null,
        });
        return jsonResponse({ ok: true, action: updated ? "trial-uncancelled" : "no-reminder" });
      }
      case "RENEWAL": {
        const updated = await updateReminderForEvent(event, eventId, eventType, occurredAtIso, {
          converted_at: occurredAtIso,
          cancelled_at: null,
        });
        return jsonResponse({ ok: true, action: updated ? "trial-converted" : "no-reminder" });
      }
      case "EXPIRATION": {
        const updated = await updateReminderForEvent(event, eventId, eventType, occurredAtIso, {
          expired_at: occurredAtIso,
        });
        return jsonResponse({ ok: true, action: updated ? "trial-expired" : "no-reminder" });
      }
      default:
        return jsonResponse({ ok: true, ignored: true, reason: "unsupported event type", eventType });
    }
  } catch (error: any) {
    console.error("revenuecat-webhook error:", error);
    return jsonResponse(
      { error: String(error?.message || error || "Internal server error") },
      500,
    );
  }
});
