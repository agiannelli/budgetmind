"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/user";
import {
  createEnvelope,
  updateEnvelope,
  deactivateEnvelope,
  reorderEnvelope,
  setEnvelopeTarget,
} from "@/lib/data/envelopes";
import { applyWindfall, type ApprovedFill } from "@/lib/data/allocations";
import { setBaselineExclusion } from "@/lib/data/spending";
import {
  ENVELOPE_KINDS,
  FUNDING_TYPES,
  COVERAGE_TIERS,
  ENVELOPE_CATALOG,
  type EnvelopeInput,
} from "@/lib/envelope-types";

type Result = { ok?: true; error?: string };

function validate(input: EnvelopeInput): string | null {
  if (!input.name.trim()) return "Give the envelope a name.";
  if (!ENVELOPE_KINDS.includes(input.kind)) return "Choose a kind.";
  if (!FUNDING_TYPES.includes(input.funding_type)) return "Choose how it's funded.";
  if (!COVERAGE_TIERS.includes(input.coverage)) return "Choose a coverage tier.";

  for (const [label, v] of [
    ["target amount", input.target_amount],
    ["monthly amount", input.monthly_contribution],
    ["current balance", input.current_balance],
  ] as const) {
    if (v != null && (!Number.isFinite(v) || v < 0)) {
      return `Enter a valid ${label} (0 or more).`;
    }
  }
  if (
    input.target_months != null &&
    (!Number.isFinite(input.target_months) || input.target_months < 0)
  ) {
    return "Enter a valid number of months.";
  }
  return null;
}

export async function createEnvelopeAction(input: EnvelopeInput): Promise<Result> {
  const user = await requireUser();
  const err = validate(input);
  if (err) return { error: err };
  try {
    await createEnvelope(user.id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create envelope." };
  }
  revalidatePath("/envelopes");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function editEnvelopeAction(
  id: string,
  input: EnvelopeInput,
): Promise<Result> {
  const user = await requireUser();
  if (!id) return { error: "Missing envelope." };
  const err = validate(input);
  if (err) return { error: err };
  try {
    await updateEnvelope(user.id, id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save changes." };
  }
  revalidatePath("/envelopes");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addStarterEnvelopeAction(key: string): Promise<Result> {
  const user = await requireUser();
  const preset = ENVELOPE_CATALOG.find((p) => p.key === key);
  if (!preset) return { error: "Unknown envelope." };

  try {
    await createEnvelope(user.id, {
      name: preset.name,
      kind: preset.kind,
      funding_type: preset.funding_type,
      target_months: preset.target_months ?? null,
      monthly_contribution: preset.monthly_contribution ?? null,
      current_balance: 0,
      is_protected: preset.is_protected,
      coverage: preset.coverage,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add envelope." };
  }
  revalidatePath("/envelopes");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function reorderEnvelopeAction(
  id: string,
  direction: "up" | "down",
): Promise<Result> {
  const user = await requireUser();
  if (!id) return { error: "Missing envelope." };
  try {
    await reorderEnvelope(user.id, id, direction);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reorder." };
  }
  revalidatePath("/envelopes");
  return { ok: true };
}

export async function acceptSuggestedTargetAction(
  envelopeId: string,
  targetAmount: number,
): Promise<Result> {
  const user = await requireUser();
  if (!envelopeId) return { error: "Missing envelope." };
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { error: "No valid suggested target yet." };
  }
  try {
    await setEnvelopeTarget(user.id, envelopeId, Math.round(targetAmount * 100) / 100);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not set the target." };
  }
  revalidatePath("/envelopes");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setBaselineExclusionAction(
  txnId: string,
  exclude: boolean,
): Promise<Result> {
  const user = await requireUser();
  if (!txnId) return { error: "Missing transaction." };
  try {
    await setBaselineExclusion(user.id, txnId, exclude);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update." };
  }
  revalidatePath("/envelopes");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function applyWindfallAction(input: {
  fills: ApprovedFill[];
}): Promise<{ ok?: true; applied?: number; total?: number; error?: string }> {
  const user = await requireUser();
  const fills = input.fills ?? [];

  for (const f of fills) {
    if (!f.envelopeId) return { error: "Missing envelope in the split." };
    if (!Number.isFinite(f.amount) || f.amount < 0) {
      return { error: "Each amount must be 0 or more." };
    }
  }
  if (!fills.some((f) => f.amount > 0)) {
    return { error: "Nothing to allocate — enter at least one amount." };
  }

  try {
    const { applied, total } = await applyWindfall(user.id, fills);
    revalidatePath("/envelopes");
    revalidatePath("/dashboard");
    return { ok: true, applied, total };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not apply the allocation.",
    };
  }
}

export async function deactivateEnvelopeAction(id: string): Promise<Result> {
  const user = await requireUser();
  if (!id) return { error: "Missing envelope." };
  try {
    await deactivateEnvelope(user.id, id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not remove envelope." };
  }
  revalidatePath("/envelopes");
  revalidatePath("/dashboard");
  return { ok: true };
}
