import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { normalizeMerchant } from "@/lib/reconcile/matcher";
import {
  monthlyEquivalent,
  type RecurringCadence,
  type RecurringItem,
  type RecurringInput,
  type RecurringCandidate,
} from "@/lib/recurring-types";

const abs = (v: number | string) =>
  Math.abs(typeof v === "string" ? Number(v) : v);

type Row = {
  id: string;
  name: string;
  cadence: RecurringCadence;
  expected_amount: number | string | null;
  category_id: string | null;
  match_merchant: string | null;
  categories: { name: string } | null;
};

const SELECT =
  "id, name, cadence, expected_amount, category_id, match_merchant, categories(name)";

function toItem(r: Row): RecurringItem {
  return {
    id: r.id,
    name: r.name,
    cadence: r.cadence,
    amount: r.expected_amount != null ? abs(r.expected_amount) : 0,
    category_id: r.category_id,
    category_name: r.categories?.name ?? null,
    match_merchant: r.match_merchant,
  };
}

/** Active recurring expense bills. */
export async function listRecurringItems(
  userId: string,
): Promise<RecurringItem[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("recurring_items")
    .select(SELECT)
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("is_active", true)
    .order("expected_amount", { ascending: true }); // most negative (biggest) first
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toItem);
}

export async function createRecurringItem(
  userId: string,
  input: RecurringInput,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("recurring_items").insert({
    user_id: userId,
    name: input.name.trim(),
    type: "expense",
    cadence: input.cadence,
    expected_amount: -Math.abs(input.amount), // signed: expense out
    category_id: input.category_id || null,
    match_merchant: input.match_merchant
      ? normalizeMerchant(input.match_merchant)
      : null,
    is_active: true,
  });
  if (error) throw new Error(error.message);
}

export async function updateRecurringItem(
  userId: string,
  id: string,
  input: RecurringInput,
): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("recurring_items")
    .update({
      name: input.name.trim(),
      cadence: input.cadence,
      expected_amount: -Math.abs(input.amount),
      category_id: input.category_id || null,
      match_merchant: input.match_merchant
        ? normalizeMerchant(input.match_merchant)
        : null,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("That bill couldn't be found.");
}

export async function deactivateRecurringItem(
  userId: string,
  id: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("recurring_items")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Map a typical gap (in days) between charges to a cadence, or null if it
 * doesn't look periodic. */
function cadenceFromGap(days: number): RecurringCadence | null {
  if (days < 11) return "weekly";
  if (days <= 45) return "monthly";
  if (days <= 135) return "quarterly";
  if (days <= 430) return "annual";
  return null;
}

/**
 * Suggest recurring bills from repeated merchants: any merchant that recurs on a
 * roughly regular cadence and isn't already tracked. Single-occurrence yearly
 * bills can't be inferred from the data — those the user adds by hand.
 */
export async function detectRecurringCandidates(
  userId: string,
): Promise<RecurringCandidate[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_date, amount, merchant_raw, category_id, categories(name)")
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("is_excluded_from_spending", false)
    .is("superseded_by", null);
  if (error) throw new Error(error.message);

  const existing = await listRecurringItems(userId);
  const covered = new Set(existing.map((r) => r.match_merchant).filter(Boolean));

  type Row2 = {
    occurred_date: string;
    amount: number | string;
    merchant_raw: string | null;
    category_id: string | null;
    categories: { name: string } | null;
  };
  const groups = new Map<
    string,
    { dates: string[]; amounts: number[]; raw: string; category_id: string | null; category_name: string | null }
  >();

  for (const r of (data ?? []) as unknown as Row2[]) {
    const key = normalizeMerchant(r.merchant_raw);
    if (!key || covered.has(key)) continue;
    const g = groups.get(key) ?? {
      dates: [],
      amounts: [],
      raw: r.merchant_raw ?? key,
      category_id: r.category_id,
      category_name: r.categories?.name ?? null,
    };
    g.dates.push(r.occurred_date);
    g.amounts.push(abs(r.amount));
    groups.set(key, g);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [key, g] of groups) {
    if (g.dates.length < 2) continue;
    const days = g.dates
      .map((d) => Date.parse(`${d}T00:00:00Z`))
      .sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < days.length; i++) {
      gaps.push((days[i] - days[i - 1]) / 86_400_000);
    }
    const cadence = cadenceFromGap(median(gaps));
    if (!cadence) continue;
    candidates.push({
      match_merchant: key,
      name: g.raw,
      cadence,
      amount: Math.round(median(g.amounts) * 100) / 100,
      category_id: g.category_id,
      category_name: g.category_name,
      occurrences: g.dates.length,
    });
  }

  return candidates.sort(
    (a, b) =>
      monthlyEquivalent(b.amount, b.cadence) -
      monthlyEquivalent(a.amount, a.cadence),
  );
}
