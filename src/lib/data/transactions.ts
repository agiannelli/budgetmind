import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { accountLabel, type Account } from "@/lib/data/accounts";
import type { TxnType } from "@/lib/data/enums";

export type Transaction = {
  id: string;
  occurred_date: string;
  amount: number;
  type: TxnType;
  merchant_raw: string | null;
  notes: string | null;
  status: string;
  source: string;
  category_name: string | null;
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
      "id, occurred_date, amount, type, merchant_raw, notes, status, source, categories(name), accounts(name, nickname)",
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
    category_name: r.categories?.name ?? null,
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
