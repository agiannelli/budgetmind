import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export type ApprovedFill = {
  envelopeId: string;
  amount: number; // positive fill
  rationale?: string | null;
};

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Apply an approved windfall allocation: record one `allocations` row per
 * envelope (the audit trail + rationale) and bump each envelope's
 * `current_balance`. Zero-amount fills are ignored. Scoped to the user's own
 * envelopes — an id that isn't theirs aborts the whole apply.
 */
export async function applyWindfall(
  userId: string,
  fills: ApprovedFill[],
): Promise<{ applied: number; total: number }> {
  const positive = fills.filter((f) => f.amount > 0);
  if (positive.length === 0) return { applied: 0, total: 0 };

  const supabase = createServiceClient();
  const ids = positive.map((f) => f.envelopeId);

  const { data: envs, error } = await supabase
    .from("envelopes")
    .select("id, current_balance")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("id", ids);
  if (error) throw new Error(error.message);

  const balById = new Map(
    (envs ?? []).map((e) => [
      e.id as string,
      typeof e.current_balance === "string"
        ? Number(e.current_balance)
        : (e.current_balance as number),
    ]),
  );
  for (const f of positive) {
    if (!balById.has(f.envelopeId)) {
      throw new Error("One of those envelopes couldn't be found.");
    }
  }

  const now = new Date().toISOString();
  const { error: aErr } = await supabase.from("allocations").insert(
    positive.map((f) => ({
      user_id: userId,
      envelope_id: f.envelopeId,
      amount: cents(f.amount), // + = fill
      source_kind: "windfall",
      status: "approved",
      approved_at: now,
      rationale: f.rationale ?? null,
    })),
  );
  if (aErr) throw new Error(aErr.message);

  // Bump balances (single user; sequential is fine).
  for (const f of positive) {
    const newBal = cents(balById.get(f.envelopeId)! + f.amount);
    const { error: uErr } = await supabase
      .from("envelopes")
      .update({ current_balance: newBal })
      .eq("id", f.envelopeId)
      .eq("user_id", userId);
    if (uErr) throw new Error(uErr.message);
  }

  const total = cents(positive.reduce((s, f) => s + f.amount, 0));
  return { applied: positive.length, total };
}
