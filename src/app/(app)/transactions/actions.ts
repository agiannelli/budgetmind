"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/user";
import { createTransaction } from "@/lib/data/transactions";
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
