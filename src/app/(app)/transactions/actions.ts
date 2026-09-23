"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/user";
import { createTransaction, updateTransaction } from "@/lib/data/transactions";
import { TXN_TYPES, type TxnType } from "@/lib/data/enums";
import type { FormState } from "@/lib/forms";

export async function addTransactionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const account_id = String(formData.get("account_id") ?? "");
  const occurred_date = String(formData.get("occurred_date") ?? "");
  const type = String(formData.get("type") ?? "") as TxnType;
  const amount = Number(formData.get("amount"));
  const merchant = String(formData.get("merchant") ?? "");
  const category_id = String(formData.get("category_id") ?? "") || null;
  const notes = String(formData.get("notes") ?? "");

  if (!account_id) return { error: "Choose an account." };
  if (!occurred_date) return { error: "Pick a date." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount greater than 0." };
  }
  if (!TXN_TYPES.includes(type)) return { error: "Choose a type." };

  try {
    await createTransaction(user.id, {
      account_id,
      occurred_date,
      amount,
      type,
      merchant,
      category_id,
      notes,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save transaction." };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function editTransactionAction(input: {
  id: string;
  account_id: string;
  occurred_date: string;
  amount: number;
  type: TxnType;
  merchant?: string | null;
  category_id?: string | null;
  notes?: string | null;
}): Promise<{ ok?: true; error?: string }> {
  const user = await requireUser();

  if (!input.id) return { error: "Missing transaction." };
  if (!input.account_id) return { error: "Choose an account." };
  if (!input.occurred_date) return { error: "Pick a date." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: "Enter an amount greater than 0." };
  }
  if (!TXN_TYPES.includes(input.type)) return { error: "Choose a type." };

  try {
    await updateTransaction(user.id, input.id, {
      account_id: input.account_id,
      occurred_date: input.occurred_date,
      amount: input.amount,
      type: input.type,
      merchant: input.merchant,
      category_id: input.category_id,
      notes: input.notes,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save changes." };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}
