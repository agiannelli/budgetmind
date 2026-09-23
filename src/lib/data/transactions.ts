import "server-only";

import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { accountLabel, type Account } from "@/lib/data/accounts";
import type { TxnType } from "@/lib/data/enums";
import type { ImportMode } from "@/lib/import-types";

export type Transaction = {
  id: string;
  occurred_date: string;
  amount: number;
  type: TxnType;
  merchant_raw: string | null;
  notes: string | null;
  status: string;
  source: string;
  category_id: string | null;
  category_name: string | null;
  account_id: string;
  account_label: string;
};

type TxnRow = {
  id: string;
  occurred_date: string;
  amount: number | string;
  type: TxnType;
  merchant_raw: string | null;
  notes: string | null;
  status: string;
  source: string;
  category_id: string | null;
  account_id: string;
  categories: { name: string } | null;
  accounts: Pick<Account, "name" | "nickname"> | null;
};

export async function listTransactions(
  userId: string,
  limit = 100,
): Promise<Transaction[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, occurred_date, amount, type, merchant_raw, notes, status, source, category_id, account_id, categories(name), accounts(name, nickname)",
    )
    .eq("user_id", userId)
    .is("superseded_by", null)
    .order("occurred_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as TxnRow[]).map((r) => ({
    id: r.id,
    occurred_date: r.occurred_date,
    amount: typeof r.amount === "string" ? Number(r.amount) : r.amount,
    type: r.type,
    merchant_raw: r.merchant_raw,
    notes: r.notes,
    status: r.status,
    source: r.source,
    category_id: r.category_id,
    category_name: r.categories?.name ?? null,
    account_id: r.account_id,
    account_label: r.accounts ? accountLabel(r.accounts) : "—",
  }));
}

/**
 * Insert a manual (provisional) transaction. The UI collects a positive
 * magnitude; we apply the sign from the type (income in, everything else out)
 * and exclude transfers/savings from "spending".
 */
export async function createTransaction(
  userId: string,
  input: {
    account_id: string;
    occurred_date: string;
    amount: number;
    type: TxnType;
    merchant?: string | null;
    category_id?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const magnitude = Math.abs(input.amount);
  const signed = input.type === "income" ? magnitude : -magnitude;
  const excluded = input.type === "transfer" || input.type === "savings";

  const supabase = createServiceClient();
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    account_id: input.account_id,
    occurred_date: input.occurred_date,
    amount: signed,
    type: input.type,
    is_excluded_from_spending: excluded,
    merchant_raw: input.merchant?.trim() || null,
    category_id: input.category_id || null,
    notes: input.notes?.trim() || null,
    source: "manual",
    status: "unconfirmed",
    fidelity: "current",
  });

  if (error) throw new Error(error.message);
}

/**
 * Edit an existing transaction. Like `createTransaction`, the UI supplies a
 * positive magnitude and we re-derive the sign and spending exclusion from the
 * type. Scoped to the user's own, non-superseded rows so retired (merged-away)
 * entries can't be edited back into the ledger.
 */
export async function updateTransaction(
  userId: string,
  id: string,
  input: {
    account_id: string;
    occurred_date: string;
    amount: number;
    type: TxnType;
    merchant?: string | null;
    category_id?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const magnitude = Math.abs(input.amount);
  const signed = input.type === "income" ? magnitude : -magnitude;
  const excluded = input.type === "transfer" || input.type === "savings";

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({
      account_id: input.account_id,
      occurred_date: input.occurred_date,
      amount: signed,
      type: input.type,
      is_excluded_from_spending: excluded,
      merchant_raw: input.merchant?.trim() || null,
      category_id: input.category_id || null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .is("superseded_by", null)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("That transaction couldn't be found.");
  }
}

/** Stable per-row key for idempotent re-imports (same statement never double-counts). */
function importHash(
  accountId: string,
  occurredDate: string,
  signedAmount: number,
  merchant: string,
): string {
  return createHash("sha256")
    .update(
      `${accountId}|${occurredDate}|${signedAmount.toFixed(2)}|${merchant.trim().toLowerCase()}`,
    )
    .digest("hex");
}

/**
 * Persist imported transactions. Idempotent: re-importing the same statement
 * skips rows whose (user_id, import_hash) already exists. `mode` records the
 * two-fidelity origin (bulk backfill vs. current). Returns inserted/skipped.
 */
export type InsertedFeedRow = {
  id: string;
  occurred_date: string;
  amount: number; // signed
  type: TxnType;
  merchant_raw: string | null;
  category_id: string | null;
};

export async function insertImportedTransactions(
  userId: string,
  accountId: string,
  mode: ImportMode,
  rows: {
    occurred_date: string;
    amount: number; // positive magnitude
    type: TxnType;
    merchant: string;
    category_id: string | null;
  }[],
): Promise<{ inserted: number; skipped: number; insertedRows: InsertedFeedRow[] }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0, insertedRows: [] };

  const records = rows.map((r) => {
    const magnitude = Math.abs(r.amount);
    const signed = r.type === "income" ? magnitude : -magnitude;
    const merchant = r.merchant?.trim() || "";
    return {
      user_id: userId,
      account_id: accountId,
      occurred_date: r.occurred_date,
      amount: signed,
      type: r.type,
      is_excluded_from_spending: r.type === "transfer" || r.type === "savings",
      merchant_raw: merchant || null,
      category_id: r.category_id || null,
      source: "imported",
      status: "confirmed",
      fidelity: mode === "backfill" ? "backfill" : "current",
      import_hash: importHash(accountId, r.occurred_date, signed, merchant),
    };
  });

  const supabase = createServiceClient();
  // ignoreDuplicates → the returned rows are exactly the newly inserted ones
  // (re-imported duplicates are skipped), which is precisely what we reconcile.
  const { data, error } = await supabase
    .from("transactions")
    .upsert(records, { onConflict: "user_id,import_hash", ignoreDuplicates: true })
    .select("id, occurred_date, amount, type, merchant_raw, category_id");

  if (error) throw new Error(error.message);

  const insertedRows: InsertedFeedRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    occurred_date: r.occurred_date as string,
    amount: typeof r.amount === "string" ? Number(r.amount) : (r.amount as number),
    type: r.type as TxnType,
    merchant_raw: (r.merchant_raw as string | null) ?? null,
    category_id: (r.category_id as string | null) ?? null,
  }));

  const inserted = insertedRows.length;
  return { inserted, skipped: records.length - inserted, insertedRows };
}
