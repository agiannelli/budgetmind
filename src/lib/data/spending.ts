import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export type SpendingEstimate = {
  monthlyExpenses: number; // average spend per observed month (0 if no data)
  monthsObserved: number; // distinct calendar months with spending
};

/**
 * Estimate average monthly spending from the user's real transactions — used to
 * turn a months-based goal (e.g. "6 months of expenses" for the emergency fund)
 * into a concrete dollar target. Counts only true spending: expense-type,
 * non-excluded (transfers/savings are out), non-superseded rows.
 *
 * Averages over the distinct calendar months that actually have spending, so a
 * few months of data give a fair per-month figure rather than being diluted.
 */
export async function estimateMonthlyExpenses(
  userId: string,
): Promise<SpendingEstimate> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_date, amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("is_excluded_from_spending", false)
    .is("superseded_by", null);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { occurred_date: string; amount: number | string }[];
  if (rows.length === 0) return { monthlyExpenses: 0, monthsObserved: 0 };

  const months = new Set<string>();
  let total = 0;
  for (const r of rows) {
    const amt = typeof r.amount === "string" ? Number(r.amount) : r.amount;
    total += Math.abs(amt);
    months.add(r.occurred_date.slice(0, 7)); // YYYY-MM
  }

  const monthsObserved = months.size;
  const monthlyExpenses =
    monthsObserved > 0 ? Math.round((total / monthsObserved) * 100) / 100 : 0;
  return { monthlyExpenses, monthsObserved };
}
