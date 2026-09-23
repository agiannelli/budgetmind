import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { matchImported, type MatchCandidate } from "@/lib/reconcile/matcher";
import type { InsertedFeedRow } from "@/lib/data/transactions";

export type ReconcileSummary = {
  merged: number; // high-confidence auto-merges applied
  proposed: number; // medium-confidence pairs left for the user to confirm later
};

type ManualRow = {
  id: string;
  occurred_date: string;
  amount: number | string;
  type: string;
  merchant_raw: string | null;
  category_id: string | null;
  notes: string | null;
};

/**
 * After a statement import, match the freshly-inserted feed rows against the
 * user's open provisional (manual) entries and auto-merge the high-confidence
 * pairs: the feed row keeps the authoritative facts, inherits the manual's
 * meaning (category/notes) where it has none, and records the manual's original
 * amount in `logged_amount` for drift detection. The manual row is retired via
 * `superseded_by`, which hides it from the ledger.
 *
 * Medium-confidence pairs are counted and returned but not applied — those are
 * surfaced for explicit confirmation (review UI is a follow-up).
 */
export async function reconcileNewImports(
  userId: string,
  accountId: string,
  feedRows: InsertedFeedRow[],
): Promise<ReconcileSummary> {
  if (feedRows.length === 0) return { merged: 0, proposed: 0 };

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("id, occurred_date, amount, type, merchant_raw, category_id, notes")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("source", "manual")
    .is("superseded_by", null)
    .in("status", ["unconfirmed", "needs_review"]);

  if (error) throw new Error(error.message);
  const manuals = (data ?? []) as ManualRow[];
  if (manuals.length === 0) return { merged: 0, proposed: 0 };

  const manualById = new Map(manuals.map((m) => [m.id, m]));

  const feedCandidates: MatchCandidate[] = feedRows.map((f) => ({
    id: f.id,
    occurred_date: f.occurred_date,
    amount: f.amount,
    type: f.type,
    merchant: f.merchant_raw,
  }));
  const manualCandidates: MatchCandidate[] = manuals.map((m) => ({
    id: m.id,
    occurred_date: m.occurred_date,
    amount: typeof m.amount === "string" ? Number(m.amount) : m.amount,
    type: m.type,
    merchant: m.merchant_raw,
  }));

  const matches = matchImported(feedCandidates, manualCandidates);
  const highs = matches.filter((m) => m.tier === "high");
  const proposed = matches.filter((m) => m.tier === "medium").length;

  const feedById = new Map(feedRows.map((f) => [f.id, f]));

  for (const match of highs) {
    const feed = feedById.get(match.feedId);
    const manual = manualById.get(match.manualId);
    if (!feed || !manual) continue;

    const manualAmount =
      typeof manual.amount === "string" ? Number(manual.amount) : manual.amount;

    // Feed wins facts; manual wins meaning. Only fill category/notes the feed
    // row lacks — never clobber a category Claude already assigned.
    const feedPatch: Record<string, unknown> = { logged_amount: manualAmount };
    if (!feed.category_id && manual.category_id) {
      feedPatch.category_id = manual.category_id;
    }
    if (manual.notes) feedPatch.notes = manual.notes;

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("transactions").update(feedPatch).eq("id", feed.id).eq("user_id", userId),
      supabase
        .from("transactions")
        .update({ superseded_by: feed.id })
        .eq("id", manual.id)
        .eq("user_id", userId),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
  }

  return { merged: highs.length, proposed };
}
