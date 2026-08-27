import type { TxnType } from "@/lib/data/enums";

// Client-safe shared types for the statement-import flow.

export type ImportMode = "backfill" | "current";

/** A parsed transaction row, after Claude parsing + server-side category resolution. */
export type ParsedRow = {
  occurred_date: string; // YYYY-MM-DD
  amount: number; // positive magnitude
  type: TxnType;
  merchant: string;
  category_id: string | null;
  category_name: string | null;
  confidence: number; // 0..1
};
