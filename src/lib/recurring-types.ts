// Client-safe recurring-bill types + amortization (no "server-only").

export const RECURRING_CADENCES = [
  "weekly",
  "monthly",
  "quarterly",
  "annual",
] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export const CADENCE_LABELS: Record<RecurringCadence, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Yearly",
};

// Multiply a per-occurrence amount by this to get its monthly-equivalent cost.
const MONTHLY_MULTIPLIER: Record<RecurringCadence, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

/** A recurring bill's monthly-equivalent cost (rounded to cents). */
export function monthlyEquivalent(
  amount: number,
  cadence: RecurringCadence,
): number {
  return Math.round(Math.abs(amount) * MONTHLY_MULTIPLIER[cadence] * 100) / 100;
}

export type RecurringItem = {
  id: string;
  name: string;
  cadence: RecurringCadence;
  amount: number; // positive magnitude per occurrence
  category_id: string | null;
  category_name: string | null;
  match_merchant: string | null;
};

export type RecurringInput = {
  name: string;
  cadence: RecurringCadence;
  amount: number; // positive magnitude
  category_id?: string | null;
  match_merchant?: string | null;
};

/** A detected recurring candidate, suggested for the user to confirm. */
export type RecurringCandidate = {
  match_merchant: string;
  name: string;
  cadence: RecurringCadence;
  amount: number; // positive magnitude (typical per-occurrence)
  category_id: string | null;
  category_name: string | null;
  occurrences: number;
};
