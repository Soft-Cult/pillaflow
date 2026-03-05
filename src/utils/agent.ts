import { supabase } from "../utils/supabaseClient"; // adjust import

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

async function getAuthHeaderOrThrow() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Auth session error: ${error.message || String(error)}`);
  }

  const token = session?.access_token;
  if (!token) {
    throw new Error("No active auth session. Please sign in again.");
  }

  return { Authorization: `Bearer ${token}` };
}

async function unwrapFunctionError(error: any, fallbackMessage: string) {
  const response = error?.context;
  if (response && typeof response.status === "number") {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch {
      // ignore body parsing errors
    }

    const compactBody = String(bodyText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);

    const detail = compactBody
      ? `${fallbackMessage} (HTTP ${response.status}): ${compactBody}`
      : `${fallbackMessage} (HTTP ${response.status})`;
    return new Error(detail);
  }

  return new Error(error?.message || fallbackMessage);
}

export async function callAgent(message: string, conversationId?: string | null) {
  const headers = await getAuthHeaderOrThrow();
  const { data, error } = await supabase.functions.invoke("agent", {
    body: { message, conversationId }, // <--- add this
    headers,
  });

  if (error) {
    throw await unwrapFunctionError(error, "Agent function failed");
  }

  return data as {
    assistantText: string;
    proposals?: Proposal[];
    conversationId?: string | null;
  };
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
  const headers = await getAuthHeaderOrThrow();
  const { data, error } = await supabase.functions.invoke("apply_action", {
    body: { proposal_id: proposalId },
    headers,
  });

  if (error) {
    throw await unwrapFunctionError(error, "Apply action function failed");
  }
  return data as { ok: true; appliedResult: any };
}

// Decline = update status directly (requires correct RLS)
export async function cancelProposal(proposalId: string) {
  const { error } = await supabase
    .from("ai_action_proposals")
    .update({ status: "declined" })
    .eq("id", proposalId);

  if (error) throw error;
}
