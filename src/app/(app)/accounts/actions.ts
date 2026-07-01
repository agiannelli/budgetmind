"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/user";
import { createAccount } from "@/lib/data/accounts";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/data/enums";
import type { FormState } from "@/lib/forms";

export async function addAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim() || null;
  const institution = String(formData.get("institution") ?? "").trim() || null;

  if (!name) return { error: "Account name is required." };
  if (!ACCOUNT_TYPES.includes(type as AccountType)) {
    return { error: "Choose an account type." };
  }

  try {
    await createAccount(user.id, {
      name,
      type: type as AccountType,
      nickname,
      institution,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create account." };
  }

  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { ok: true };
}
