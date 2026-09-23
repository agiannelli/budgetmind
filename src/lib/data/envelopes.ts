import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { Envelope, EnvelopeInput } from "@/lib/envelope-types";

type EnvelopeRow = Omit<
  Envelope,
  "target_amount" | "target_months" | "monthly_contribution" | "current_balance"
> & {
  target_amount: number | string | null;
  target_months: number | string | null;
  monthly_contribution: number | string | null;
  current_balance: number | string;
};

const numN = (v: number | string | null): number | null =>
  v === null ? null : typeof v === "string" ? Number(v) : v;

const SELECT =
  "id, name, kind, funding_type, priority, target_amount, target_months, target_date, monthly_contribution, current_balance, is_protected, coverage, notes";

function toEnvelope(r: EnvelopeRow): Envelope {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    funding_type: r.funding_type,
    priority: r.priority,
    target_amount: numN(r.target_amount),
    target_months: numN(r.target_months),
    target_date: r.target_date,
    monthly_contribution: numN(r.monthly_contribution),
    current_balance: numN(r.current_balance) ?? 0,
    is_protected: r.is_protected,
    coverage: r.coverage,
    notes: r.notes,
  };
}

/** Active envelopes in priority order (the waterfall / coverage order). */
export async function listEnvelopes(userId: string): Promise<Envelope[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("envelopes")
    .select(SELECT)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as EnvelopeRow[]).map(toEnvelope);
}

function toRecord(input: EnvelopeInput) {
  return {
    name: input.name.trim(),
    kind: input.kind,
    funding_type: input.funding_type,
    target_amount: input.target_amount ?? null,
    target_months: input.target_months ?? null,
    target_date: input.target_date || null,
    monthly_contribution: input.monthly_contribution ?? null,
    current_balance: input.current_balance ?? 0,
    is_protected: input.is_protected,
    coverage: input.coverage,
    notes: input.notes?.trim() || null,
  };
}

/** Create an envelope at the end of the priority order. */
export async function createEnvelope(
  userId: string,
  input: EnvelopeInput,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: last, error: maxErr } = await supabase
    .from("envelopes")
    .select("priority")
    .eq("user_id", userId)
    .order("priority", { ascending: false })
    .limit(1);
  if (maxErr) throw new Error(maxErr.message);
  const nextPriority = (last?.[0]?.priority ?? 0) + 1;

  const { error } = await supabase.from("envelopes").insert({
    user_id: userId,
    priority: nextPriority,
    is_active: true,
    ...toRecord(input),
  });
  if (error) throw new Error(error.message);
}

export async function updateEnvelope(
  userId: string,
  id: string,
  input: EnvelopeInput,
): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("envelopes")
    .update(toRecord(input))
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("That envelope couldn't be found.");
}

/** Set just an envelope's dollar target (e.g. accepting a suggested estimate). */
export async function setEnvelopeTarget(
  userId: string,
  id: string,
  targetAmount: number,
): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("envelopes")
    .update({ target_amount: targetAmount })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("That envelope couldn't be found.");
}

/** Soft-delete: envelopes are referenced by allocations, so we deactivate. */
export async function deactivateEnvelope(userId: string, id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("envelopes")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Swap an envelope's priority with its neighbor in the given direction. Uses a
 * temporary priority to sidestep the `unique (user_id, priority)` constraint,
 * since a direct swap would momentarily collide.
 */
export async function reorderEnvelope(
  userId: string,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("envelopes")
    .select("id, priority")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { id: string; priority: number }[];
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return; // already at an end

  const a = rows[i];
  const b = rows[j];
  const TEMP = -1;

  for (const step of [
    { id: a.id, priority: TEMP },
    { id: b.id, priority: a.priority },
    { id: a.id, priority: b.priority },
  ]) {
    const { error: e } = await supabase
      .from("envelopes")
      .update({ priority: step.priority })
      .eq("id", step.id)
      .eq("user_id", userId);
    if (e) throw new Error(e.message);
  }
}
