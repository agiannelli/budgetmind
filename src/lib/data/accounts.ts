import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { AccountType } from "@/lib/data/enums";

export type Account = {
  id: string;
  name: string;
  nickname: string | null;
  type: AccountType;
  institution: string | null;
  is_active: boolean;
};

/** A user-facing label: prefer the nickname, fall back to the bank name. */
export function accountLabel(a: Pick<Account, "name" | "nickname">): string {
  return a.nickname?.trim() || a.name;
}

export async function listAccounts(userId: string): Promise<Account[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, nickname, type, institution, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Account[];
}

export async function createAccount(
  userId: string,
  input: {
    name: string;
    type: AccountType;
    nickname?: string | null;
    institution?: string | null;
  },
): Promise<Account> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: input.name,
      type: input.type,
      nickname: input.nickname ?? null,
      institution: input.institution ?? null,
    })
    .select("id, name, nickname, type, institution, is_active")
    .single();

  if (error) throw new Error(error.message);
  return data as Account;
}
