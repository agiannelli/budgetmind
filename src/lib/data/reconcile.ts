import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { matchImported, type MatchCandidate } from "@/lib/reconcile/matcher";
import type { InsertedFeedRow } from "@/lib/data/transactions";

/** A medium-confidence pairing surfaced for the user to confirm or dismiss. */
export type ProposedMatch = {
  feedId: string;
  manualId: string;
  amountDelta: number; // |feed| - |manual|
  dayGap: number;
  feed: MatchSideView;
  manual: MatchSideView;
};

export type MatchSideView = {
  occurred_date: string;
  amount: number; // signed
  merchant: string | null;
  category_id: string | null;
};

export type ReconcileSummary = {
  merged: number; // high-confidence auto-merges applied
  proposals: ProposedMatch[]; // medium-confidence pairs left for the user to confirm
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

function num(v: number | string): number {
  return typeof v === "string" ? Number(v) : v;
}

/**
 * Merge a manual (provisional) row into an imported feed row. Feed wins the
 * facts; the manual's category/notes fill gaps the feed lacks (never clobbering
 * a category the feed already has); the manual's original amount is recorded in
 * `logged_amount` for drift detection; the manual row is retired via
 * `superseded_by`, which hides it from the ledger.
 */
async function mergeFeedIntoManual(
  supabase: SupabaseClient,
  userId: string,
  feed: { id: string; category_id: string | null },
  manual: {
    id: string;
    amount: number;
    category_id: string | null;
    notes: string | null;
  },
): Promise<void> {
  const feedPatch: Record<string, unknown> = { logged_amount: manual.amount };
  if (!feed.category_id && manual.category_id) feedPatch.category_id = manual.category_id;
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

/**
 * After a statement import, match the freshly-inserted feed rows against the
 * user's open provisional (manual) entries. High-confidence pairs are
 * auto-merged silently; medium-confidence pairs are returned for the user to
 * confirm or dismiss (both entries stand until then).
 */
export async function reconcileNewImports(
  userId: string,
  accountId: string,
  feedRows: InsertedFeedRow[],
): Promise<ReconcileSummary> {
  if (feedRows.length === 0) return { merged: 0, proposals: [] };

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
  if (manuals.length === 0) return { merged: 0, proposals: [] };

  const manualById = new Map(manuals.map((m) => [m.id, m]));
  const feedById = new Map(feedRows.map((f) => [f.id, f]));

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
    amount: num(m.amount),
    type: m.type,
    merchant: m.merchant_raw,
  }));

  const matches = matchImported(feedCandidates, manualCandidates);

  let merged = 0;
  const proposals: ProposedMatch[] = [];

  for (const match of matches) {
    const feed = feedById.get(match.feedId);
    const manual = manualById.get(match.manualId);
    if (!feed || !manual) continue;

    if (match.tier === "high") {
      await mergeFeedIntoManual(supabase, userId, feed, {
        id: manual.id,
        amount: num(manual.amount),
        category_id: manual.category_id,
        notes: manual.notes,
      });
      merged++;
    } else if (match.tier === "medium") {
      proposals.push({
        feedId: feed.id,
        manualId: manual.id,
        amountDelta: match.amountDelta,
        dayGap: match.dayGap,
        feed: {
          occurred_date: feed.occurred_date,
          amount: feed.amount,
          merchant: feed.merchant_raw,
          category_id: feed.category_id,
        },
        manual: {
          occurred_date: manual.occurred_date,
          amount: num(manual.amount),
          merchant: manual.merchant_raw,
          category_id: manual.category_id,
        },
      });
    }
  }

  return { merged, proposals };
}

/**
 * Apply a user-confirmed medium-confidence match. Re-fetches both rows and
 * verifies they're still eligible (feed is an open imported row, manual is an
 * open provisional row owned by the user) before merging — the import screen
 * that proposed the match may be stale.
 */
export async function confirmProposedMatch(
  userId: string,
  feedId: string,
  manualId: string,
): Promise<void> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("id, source, category_id, amount, notes, superseded_by")
    .eq("user_id", userId)
    .in("id", [feedId, manualId]);

  if (error) throw new Error(error.message);

  const feed = data?.find((r) => r.id === feedId);
  const manual = data?.find((r) => r.id === manualId);
  if (!feed || !manual) throw new Error("One of these transactions no longer exists.");
  if (feed.superseded_by || manual.superseded_by) {
    throw new Error("This match was already resolved.");
  }
  if (feed.source !== "imported" || manual.source !== "manual") {
    throw new Error("These transactions can't be merged.");
  }

  await mergeFeedIntoManual(
    supabase,
    userId,
    { id: feed.id, category_id: feed.category_id },
    {
      id: manual.id,
      amount: num(manual.amount),
      category_id: manual.category_id,
      notes: manual.notes,
    },
  );
}
