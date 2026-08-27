import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { TXN_TYPES, type TxnType } from "@/lib/data/enums";

// Lazy singleton so a missing ANTHROPIC_API_KEY doesn't throw at import time
// (keeps CI builds green without secrets).
let _client: Anthropic | null = null;
function client(): Anthropic {
  return (_client ??= new Anthropic());
}

export type ParsedTxn = {
  occurred_date: string;
  amount: number;
  type: TxnType;
  merchant: string;
  category_name: string;
  confidence: number;
};

const UNCATEGORIZED = "Uncategorized";

/**
 * Parse pasted/uploaded statement text into structured transactions with Claude.
 * `categoryNames` constrains the category choice to the user's own list.
 */
export async function parseStatement(input: {
  text: string;
  categoryNames: string[];
}): Promise<ParsedTxn[]> {
  const categories = [...input.categoryNames, UNCATEGORIZED];

  const schema = z.object({
    transactions: z.array(
      z.object({
        occurred_date: z.string(),
        amount: z.number(),
        type: z.enum([...TXN_TYPES]),
        merchant: z.string(),
        category_name: z.enum(categories as [string, ...string[]]),
        confidence: z.number(),
      }),
    ),
  });

  const system = [
    "You parse a personal bank or credit-card statement into individual transactions.",
    "The input may be CSV, a copied list, or free text.",
    "For each real transaction, output:",
    "- occurred_date: the transaction date, as YYYY-MM-DD.",
    "- amount: a POSITIVE number (magnitude only — never negative).",
    "- type: one of income, expense, transfer, savings — based on whether money came in (income) or went out (everything else).",
    "- merchant: the merchant or description, cleaned up.",
    `- category_name: choose exactly one from this list, or "${UNCATEGORIZED}" if none fits: ${categories.join(", ")}.`,
    "- confidence: 0 to 1, how confident you are in the categorization.",
    "Ignore header rows, running balances, subtotals, and summary lines. Do not invent transactions.",
  ].join("\n");

  const res = await client().messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: input.text }],
    output_config: { format: zodOutputFormat(schema) },
  });

  if (res.stop_reason === "refusal") {
    throw new Error("The parser declined to process this content.");
  }
  if (!res.parsed_output) {
    throw new Error("Could not parse the statement into transactions.");
  }

  return res.parsed_output.transactions;
}
