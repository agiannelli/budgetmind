// Pure windfall waterfall — no I/O, no server-only, fully unit-testable.
//
// "Money in" direction of the bidirectional engine (PRD §6.3): given an amount
// and the user's envelopes in priority order, propose how to fill them. Each
// envelope is filled up to its remaining "room" before the next; whatever is
// left over is free/unallocated. Always a proposal — the user confirms/adjusts.

import type { Envelope } from "@/lib/envelope-types";

export type WaterfallFill = {
  envelopeId: string;
  name: string;
  amount: number; // proposed fill (>= 0)
  room: number | null; // remaining capacity, or null when unbounded/undefined
  rationale: string;
};

export type WaterfallProposal = {
  fills: WaterfallFill[]; // one per envelope, in priority order (may be 0)
  free: number; // amount left after filling to room
  totalFilled: number;
};

/** Round to cents to avoid floating-point drift in proposed amounts. */
function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * An envelope's effective dollar target: its explicit `target_amount`, or — for
 * a build-to-target goal expressed in months (e.g. the emergency fund) — the
 * months × estimated monthly spend. Null when neither is available.
 */
export function effectiveTarget(
  e: Envelope,
  monthlyExpenses?: number,
): number | null {
  if (e.target_amount != null) return e.target_amount;
  if (
    e.funding_type === "build_to_target" &&
    e.target_months != null &&
    monthlyExpenses != null &&
    monthlyExpenses > 0
  ) {
    return cents(e.target_months * monthlyExpenses);
  }
  return null;
}

/**
 * How much an envelope can still absorb, and null when it has no defined
 * capacity (a build-to-target with no dollar/months target yet — we don't
 * invent one, we let the user bump it by hand).
 */
export function envelopeRoom(e: Envelope, monthlyExpenses?: number): number | null {
  switch (e.funding_type) {
    case "monthly_fund":
      return e.monthly_contribution != null
        ? Math.max(0, e.monthly_contribution)
        : null;
    case "build_to_target": {
      const target = effectiveTarget(e, monthlyExpenses);
      return target != null ? Math.max(0, cents(target - e.current_balance)) : null;
    }
    case "refill_to_cap":
      return e.target_amount != null
        ? Math.max(0, cents(e.target_amount - e.current_balance))
        : null;
    default:
      return null;
  }
}

function rationaleFor(
  e: Envelope,
  room: number | null,
  monthlyExpenses?: number,
): string {
  if (e.funding_type === "monthly_fund") return "Monthly set-aside";
  if (e.funding_type === "refill_to_cap") {
    return e.target_amount != null
      ? `Refill toward the ${money(e.target_amount)} cap`
      : "No cap set — add by hand";
  }
  // build_to_target
  if (e.target_amount != null) return `Toward the ${money(e.target_amount)} target`;
  if (e.target_months != null) {
    const target = effectiveTarget(e, monthlyExpenses);
    return target != null
      ? `Toward ~${money(target)} (${e.target_months} mo of spending)`
      : `Set a dollar target to auto-fill (currently ${e.target_months} mo)`;
  }
  return room == null ? "No target set — add by hand" : "";
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Propose a fill across envelopes (already priority-ordered, highest first).
 * Envelopes with no defined room are proposed at 0 so the user can bump them.
 */
export function proposeWaterfall(
  amount: number,
  envelopes: Envelope[],
  monthlyExpenses?: number,
): WaterfallProposal {
  let remaining = cents(Math.max(0, amount));
  const fills: WaterfallFill[] = [];

  for (const e of envelopes) {
    const room = envelopeRoom(e, monthlyExpenses);
    const fill = room == null ? 0 : cents(Math.min(room, remaining));
    remaining = cents(remaining - fill);
    fills.push({
      envelopeId: e.id,
      name: e.name,
      amount: fill,
      room,
      rationale: rationaleFor(e, room, monthlyExpenses),
    });
  }

  const totalFilled = cents(fills.reduce((s, f) => s + f.amount, 0));
  return { fills, free: cents(Math.max(0, amount) - totalFilled), totalFilled };
}
