import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { TxnType } from "@/lib/data/enums";

export type Category = {
  id: string;
  name: string;
  kind: TxnType;
  is_discretionary: boolean;
};

export async function listCategories(userId: string): Promise<Category[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, is_discretionary")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("kind", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}
