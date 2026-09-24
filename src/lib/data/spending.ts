import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { normalizeMerchant } from "@/lib/reconcile/matcher";
import { listRecurringItems } from "@/lib/data/recurring";
import { monthlyEquivalent } from "@/lib/recurring-types";

export type SpendingEstimate = {
  monthlyExpenses: number; // total: amortized recurring + variable average
  monthsObserved: number;
  excludedCount: number; // one-off purchases the user excluded
  recurringMonthly: number; // amortized recurring bills
  variableMonthly: number; // averaged variable (non-recurring) spend
};

export type LargePurchase = {
  id: string;
  occurred_date: string;
  merchant: string | null;
  amount: number; // magnitude (positive)
  category_name: string | null;
  occurrences: number;
  excluded: boolean;
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
const cents = (n: number) => Math.round(n * 100) / 100;

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
 * Estimate average monthly spending, used to size months-based goals. The
 * baseline is: amortized recurring bills (a quarterly tax counts as a third of
 * itself each month, a yearly insurance a twelfth) plus the average of variable
 * spend. Transactions matched by a recurring item are pulled out of the variable
 * average so they aren't counted twice, and one-offs the user flagged are
 * dropped entirely.
 */
export async function estimateMonthlyExpenses(
  userId: string,
): Promise<SpendingEstimate> {
  const [rows, recurring] = await Promise.all([
    spendingRows(userId),
    listRecurringItems(userId),
  ]);

  const recurringMonthly = cents(
    recurring.reduce((s, r) => s + monthlyEquivalent(r.amount, r.cadence), 0),
  );
  const matchSet = new Set(
    recurring.map((r) => r.match_merchant).filter(Boolean) as string[],
  );

  const excludedCount = rows.filter((r) => r.exclude_from_baseline).length;
  const baseline = rows.filter((r) => !r.exclude_from_baseline);

  const months = new Set(baseline.map((r) => r.occurred_date.slice(0, 7)));
  const monthsObserved = months.size;

  const variableTotal = baseline
    .filter((r) => !matchSet.has(normalizeMerchant(r.merchant_raw)))
    .reduce((s, r) => s + abs(r.amount), 0);
  const variableMonthly =
    monthsObserved > 0 ? cents(variableTotal / monthsObserved) : 0;

  return {
    monthlyExpenses: cents(recurringMonthly + variableMonthly),
    monthsObserved,
    excludedCount,
    recurringMonthly,
    variableMonthly,
  };
}

/**
 * Largest purchases to review for one-off exclusion. Recurring-item matches are
 * left out (they're handled as bills, not one-offs); a recurrence hint helps the
 * user tell a mortgage from a one-time buy.
 */
export async function listLargePurchases(
  userId: string,
  limit = 20,
): Promise<LargePurchase[]> {
  const [rows, recurring] = await Promise.all([
    spendingRows(userId),
    listRecurringItems(userId),
  ]);
  if (rows.length === 0) return [];
  const matchSet = new Set(
    recurring.map((r) => r.match_merchant).filter(Boolean) as string[],
  );

  const key = (r: SpendRow) => normalizeMerchant(r.merchant_raw);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);

  return rows
    .filter((r) => !matchSet.has(key(r)))
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
