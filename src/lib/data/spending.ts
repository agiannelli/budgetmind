import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export type SpendingEstimate = {
  monthlyExpenses: number; // average spend per observed month (0 if no data)
  monthsObserved: number; // distinct calendar months with spending
  excludedCount: number; // one-off purchases the user has excluded
};

export type LargePurchase = {
  id: string;
  occurred_date: string;
  merchant: string | null;
  amount: number; // magnitude (positive)
  category_name: string | null;
  occurrences: number; // times this merchant appears in spending (recurrence hint)
  excluded: boolean; // currently excluded from the baseline
};

type SpendRow = {
  id: string;
  occurred_date: string;
  amount: number | string;
  merchant_raw: string | null;
  exclude_from_baseline: boolean;
  categories: { name: string } | null;
};

const abs = (v: number | string) =>
  Math.abs(typeof v === "string" ? Number(v) : v);

/** All of the user's real spending rows (expense, not a transfer/savings, live). */
async function spendingRows(userId: string): Promise<SpendRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, occurred_date, amount, merchant_raw, exclude_from_baseline, categories(name)",
    )
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("is_excluded_from_spending", false)
    .is("superseded_by", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SpendRow[];
}

/**
 * Estimate average monthly spending — used to turn a months-based goal (e.g.
 * "6 months of expenses") into a dollar target. Excludes one-off purchases the
 * user flagged (`exclude_from_baseline`) so a car or a vacation doesn't inflate
 * the recurring number. Averages over the distinct calendar months observed.
 */
export async function estimateMonthlyExpenses(
  userId: string,
): Promise<SpendingEstimate> {
  const rows = await spendingRows(userId);
  const excludedCount = rows.filter((r) => r.exclude_from_baseline).length;
  const baseline = rows.filter((r) => !r.exclude_from_baseline);
  if (baseline.length === 0) {
    return { monthlyExpenses: 0, monthsObserved: 0, excludedCount };
  }

  const months = new Set<string>();
  let total = 0;
  for (const r of baseline) {
    total += abs(r.amount);
    months.add(r.occurred_date.slice(0, 7)); // YYYY-MM
  }
  const monthsObserved = months.size;
  const monthlyExpenses =
    monthsObserved > 0 ? Math.round((total / monthsObserved) * 100) / 100 : 0;
  return { monthlyExpenses, monthsObserved, excludedCount };
}

/**
 * The user's largest purchases, as candidates to review for one-off exclusion.
 * Returns the biggest by amount with a recurrence hint (how many times the same
 * merchant appears) so a monthly mortgage reads differently from a one-time buy.
 */
export async function listLargePurchases(
  userId: string,
  limit = 20,
): Promise<LargePurchase[]> {
  const rows = await spendingRows(userId);
  if (rows.length === 0) return [];

  const key = (r: SpendRow) => (r.merchant_raw ?? "").trim().toLowerCase();
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);

  return rows
    .map((r) => ({
      id: r.id,
      occurred_date: r.occurred_date,
      merchant: r.merchant_raw,
      amount: abs(r.amount),
      category_name: r.categories?.name ?? null,
      occurrences: counts.get(key(r)) ?? 1,
      excluded: r.exclude_from_baseline,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/** Mark (or unmark) a transaction as excluded from the recurring baseline. */
export async function setBaselineExclusion(
  userId: string,
  txnId: string,
  exclude: boolean,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("transactions")
    .update({ exclude_from_baseline: exclude })
    .eq("id", txnId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
