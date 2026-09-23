"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/user";
import { listCategories } from "@/lib/data/categories";
import { insertImportedTransactions } from "@/lib/data/transactions";
import { reconcileNewImports } from "@/lib/data/reconcile";
import { parseStatement } from "@/lib/ai/parse-statement";
import type { ImportMode, ParsedRow } from "@/lib/import-types";

const MAX_INPUT_CHARS = 100_000;

export async function parseStatementAction(input: {
  text: string;
}): Promise<{ rows?: ParsedRow[]; error?: string }> {
  const user = await requireUser();

  const text = input.text?.trim() ?? "";
  if (!text) return { error: "Paste a statement or upload a CSV first." };
  if (text.length > MAX_INPUT_CHARS) {
    return {
      error: "That's a lot at once — split it into smaller chunks and import in batches.",
    };
  }

  const categories = await listCategories(user.id);
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  try {
    const parsed = await parseStatement({
      text,
      categoryNames: categories.map((c) => c.name),
    });

    const rows: ParsedRow[] = parsed.map((t) => ({
      occurred_date: t.occurred_date,
      amount: t.amount,
      type: t.type,
      merchant: t.merchant,
      category_id: byName.get(t.category_name?.toLowerCase() ?? "") ?? null,
      category_name: t.category_name || null,
      confidence: t.confidence,
    }));

    return { rows };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not parse the statement.",
    };
  }
}

export async function commitImportAction(input: {
  accountId: string;
  mode: ImportMode;
  rows: ParsedRow[];
}): Promise<{
  inserted?: number;
  skipped?: number;
  merged?: number;
  proposed?: number;
  error?: string;
}> {
  const user = await requireUser();

  if (!input.accountId) return { error: "Choose an account for this import." };
  if (!input.rows?.length) return { error: "Nothing selected to import." };

  try {
    const { inserted, skipped, insertedRows } = await insertImportedTransactions(
      user.id,
      input.accountId,
      input.mode,
      input.rows.map((r) => ({
        occurred_date: r.occurred_date,
        amount: r.amount,
        type: r.type,
        merchant: r.merchant,
        category_id: r.category_id,
      })),
    );

    // Auto-merge freshly-imported rows against open provisional entries.
    const { merged, proposed } = await reconcileNewImports(
      user.id,
      input.accountId,
      insertedRows,
    );

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return { inserted, skipped, merged, proposed };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not save the import.",
    };
  }
}
