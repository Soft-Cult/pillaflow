import { SUPABASE_URL, supabase } from "../utils/supabaseClient";
import {
  applyActionForUser,
  insertProposal,
  isMissingRelationError,
  parseMessageToProposal,
  updateProposalStatus,
} from "../../supabase/functions/_shared/agent-core";

export type Proposal = {
  id: string;
  action_type:
    | "create_task" | "update_task"
    | "create_habit" | "complete_habit"
    | "create_note"
    | "log_health_daily" | "add_food_entry"
    | "create_routine" | "add_routine_task"
    | "create_reminder"
    | "create_chore"
    | "create_grocery";
  action_payload: any;
  status: "pending" | "applied" | "declined";
  created_at?: string;
};

export type ProposalRow = Proposal;

const createConversationId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function assertActiveSessionOrThrow() {
  const {
    data: { session: rawSession },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Auth session error: ${error.message || String(error)}`);
  }

  let session = rawSession;
  const expiresSoon =
    typeof session?.expires_at === "number" &&
    session.expires_at * 1000 <= Date.now() + 30_000;

  if (expiresSoon && session?.refresh_token) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: session.refresh_token,
    });
    if (refreshError) {
      throw new Error(`Auth refresh error: ${refreshError.message || String(refreshError)}`);
    }
    session = refreshed?.session ?? session;
  }

  const token = String(session?.access_token || "")
    .trim()
    .replace(/\s+/g, "");
  if (!token) {
    throw new Error("No active auth session. Please sign in again.");
  }

  if (token.split(".").length !== 3) {
    throw new Error("Invalid auth session token. Please sign in again.");
  }

  return token;
}

async function resolveUserIdFromToken(token: string) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw new Error("Session is invalid. Please sign in again.");
  }
  return data.user.id;
}

const looksLikeHtmlResponse = (text: string) =>
  /<html[\s>]|<!doctype html|<head>|<body>/i.test(String(text || ""));

const compactText = (value: unknown) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);

async function unwrapFunctionError(
  error: any,
  fallbackMessage: string,
  prefetchedBodyText?: string,
) {
  const response = error?.context;
  if (response && typeof response.status === "number") {
    let bodyText = "";
    try {
      bodyText =
        typeof prefetchedBodyText === "string"
          ? prefetchedBodyText
          : await response.text();
    } catch {
      // ignore body parsing errors
    }

    const compactBody = compactText(bodyText);

    const detail = compactBody
      ? `${fallbackMessage} (HTTP ${response.status}): ${compactBody}`
      : `${fallbackMessage} (HTTP ${response.status})`;
    return new Error(detail);
  }

  return new Error(error?.message || fallbackMessage);
}

async function parseEdgeResponse(response: Response) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return await response.json();
  }
  return await response.text();
}

const buildHttpError = async (response: Response, fallbackMessage: string) => {
  const rawBody = await response.text().catch(() => "");
  const compactBody = compactText(rawBody);
  const requestId = response.headers.get("sb-request-id");
  const requestIdHint = requestId ? ` [request-id: ${requestId}]` : "";
  const detail = compactBody
    ? `${fallbackMessage} (HTTP ${response.status}): ${compactBody}${requestIdHint}`
    : `${fallbackMessage} (HTTP ${response.status})${requestIdHint}`;
  return new Error(detail);
};

async function invokeEdgeWithGatewayFallback<T>(
  functionName: string,
  body: Record<string, unknown>,
  token: string,
  fallbackMessage: string,
): Promise<T> {
  // Use direct fetch first to avoid SDK transport quirks on mobile.
  let direct: Response | null = null;
  try {
    direct = await fetch(
      `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );
  } catch (directError: any) {
    // If the direct path itself failed at transport level, try SDK invoke.
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!error) {
      return data as T;
    }

    const response = error?.context;
    if (response && typeof response.status === "number") {
      let responseBody = "";
      try {
        responseBody = await response.text();
      } catch {
        // ignore read errors
      }

      const requestId = response.headers?.get?.("sb-request-id");
      const requestIdHint = requestId ? ` [request-id: ${requestId}]` : "";
      if (response.status === 400 && looksLikeHtmlResponse(responseBody)) {
        const compactBody = compactText(responseBody);
        throw new Error(
          compactBody
            ? `${fallbackMessage} (HTTP 400): ${compactBody}${requestIdHint}`
            : `${fallbackMessage} (HTTP 400)${requestIdHint}`,
        );
      }

      const unwrapped = await unwrapFunctionError(error, fallbackMessage, responseBody);
      unwrapped.message = `${unwrapped.message}${requestIdHint}`;
      throw unwrapped;
    }

    if (directError?.message) {
      throw new Error(`${fallbackMessage}: ${String(directError.message)}`);
    }

    throw await unwrapFunctionError(error, fallbackMessage);
  }

  if (direct.ok) {
    return (await parseEdgeResponse(direct)) as T;
  }

  throw await buildHttpError(direct, fallbackMessage);
}

const isGatewayHtml400Error = (error: unknown) => {
  const message = String((error as any)?.message || "");
  return /\(HTTP 400\)/i.test(message) && /<html|400 bad request/i.test(message);
};

async function runLocalAgentFallback(
  message: string,
  conversationId: string | null | undefined,
  token: string,
) {
  const userId = await resolveUserIdFromToken(token);
  const finalConversationId = String(conversationId || createConversationId());
  const parsed = parseMessageToProposal(message);

  if (!parsed.proposal) {
    return {
      assistantText: parsed.assistantText,
      conversationId: finalConversationId,
      proposals: [] as Proposal[],
    };
  }

  const insertion = await insertProposal({
    client: supabase,
    userId,
    conversationId: finalConversationId,
    message,
    proposal: parsed.proposal,
  });

  if (!insertion.error && insertion.data) {
    const proposalRow: Proposal = {
      id: insertion.data.id,
      action_type: insertion.data.action_type ?? parsed.proposal.action_type,
      action_payload: insertion.data.action_payload ?? parsed.proposal.action_payload,
      status: insertion.data.status ?? "pending",
      created_at: insertion.data.created_at ?? undefined,
    };
    return {
      assistantText: parsed.assistantText,
      conversationId: finalConversationId,
      proposals: proposalRow.id ? [proposalRow] : [],
    };
  }

  if (isMissingRelationError(insertion.error, "ai_action_proposals")) {
    const appliedResult = await applyActionForUser({
      client: supabase,
      userId,
      actionType: parsed.proposal.action_type,
      actionPayload: parsed.proposal.action_payload,
    });
    return {
      assistantText: "Done. I saved that directly because the proposals table is unavailable.",
      conversationId: finalConversationId,
      proposals: [] as Proposal[],
      appliedResult,
    };
  }

  const insertionError = String(insertion.error?.message || insertion.error || "Unknown error");
  throw new Error(`Agent local fallback failed: ${insertionError}`);
}

async function runLocalApplyFallback(proposalId: string, token: string) {
  const userId = await resolveUserIdFromToken(token);
  const { data: proposalRow, error: proposalError } = await supabase
    .from("ai_action_proposals")
    .select("id, user_id, action_type, action_payload, status")
    .eq("id", proposalId)
    .single();

  if (proposalError) {
    throw new Error(proposalError.message || "Proposal not found");
  }

  if (proposalRow?.user_id && proposalRow.user_id !== userId) {
    throw new Error("Forbidden");
  }

  const currentStatus = String(proposalRow?.status || "pending");
  if (currentStatus === "applied") {
    return { ok: true as const, appliedResult: null, alreadyApplied: true as const };
  }

  const appliedResult = await applyActionForUser({
    client: supabase,
    userId,
    actionType: proposalRow?.action_type,
    actionPayload:
      proposalRow?.action_payload && typeof proposalRow.action_payload === "object"
        ? proposalRow.action_payload
        : {},
  });

  await updateProposalStatus({
    client: supabase,
    proposalId,
    status: "applied",
    details: {
      applied_at: new Date().toISOString(),
      applied_result: appliedResult ?? null,
    },
  });

  return { ok: true as const, appliedResult };
}

export async function callAgent(message: string, conversationId?: string | null) {
  const token = await assertActiveSessionOrThrow();
  try {
    return await invokeEdgeWithGatewayFallback<{
      assistantText: string;
      proposals?: Proposal[];
      conversationId?: string | null;
    }>("agent", { message, conversationId: conversationId ?? null }, token, "Agent function failed");
  } catch (error) {
    if (isGatewayHtml400Error(error)) {
      return await runLocalAgentFallback(message, conversationId, token);
    }
    throw error;
  }
}


// ChatScreen expects sendToAgent, so make it an alias
export async function sendToAgent(message: string, conversationId?: string | null) {
  return callAgent(message, conversationId);
}

// If you ever return proposal IDs from the agent, ChatScreen uses this
export async function fetchProposalsByIds(ids: string[]) {
  const { data, error } = await supabase
    .from("ai_action_proposals")
    .select("id, action_type, action_payload, status, created_at")
    .in("id", ids);

  if (error) throw error;
  return (data ?? []) as ProposalRow[];
}

// Approve = call your apply_action edge function
export async function applyProposal(proposalId: string) {
  const token = await assertActiveSessionOrThrow();
  try {
    return await invokeEdgeWithGatewayFallback<{ ok: true; appliedResult: any }>(
      "apply_action",
      { proposal_id: proposalId },
      token,
      "Apply action function failed",
    );
  } catch (error) {
    if (isGatewayHtml400Error(error)) {
      return await runLocalApplyFallback(proposalId, token);
    }
    throw error;
  }
}

// Decline = update status directly (requires correct RLS)
export async function cancelProposal(proposalId: string) {
  const { error } = await supabase
    .from("ai_action_proposals")
    .update({ status: "declined" })
    .eq("id", proposalId);

  if (error) throw error;
}
