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
// Rows per Claude call. Kept well under the ~250-row / 16k-output-token ceiling
// so a single chunk never truncates the structured JSON.
const CHUNK_LINES = 150;

/**
 * Split statement text into chunks small enough that each parse stays under the
 * model's output-token cap. A detected header line is repeated on every chunk so
 * Claude keeps the column context.
 */
function splitChunks(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const first = lines[0];
  const looksLikeHeader =
    /(date|description|amount|balance|posted|debit|credit|transaction|merchant)/i.test(
      first,
    ) && !/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/.test(first);

  const header = looksLikeHeader ? first : null;
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  if (dataLines.length <= CHUNK_LINES) return [text];

  const chunks: string[] = [];
  for (let i = 0; i < dataLines.length; i += CHUNK_LINES) {
    const slice = dataLines.slice(i, i + CHUNK_LINES).join("\n");
    chunks.push(header ? `${header}\n${slice}` : slice);
  }
  return chunks;
}

async function parseChunk(
  text: string,
  categories: string[],
): Promise<ParsedTxn[]> {
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

  // Thinking disabled: this is mechanical extraction, and adaptive thinking
  // would otherwise eat into max_tokens and truncate the JSON on large inputs.
  const res = await client().messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 16000,
    thinking: { type: "disabled" },
    system,
    messages: [{ role: "user", content: text }],
    output_config: { format: zodOutputFormat(schema) },
  });

  if (res.stop_reason === "refusal") {
    throw new Error("The parser declined to process this content.");
  }
  if (res.stop_reason === "max_tokens") {
    throw new Error(
      "That batch was too large to parse in one pass — try a smaller date range.",
    );
  }
  if (!res.parsed_output) {
    throw new Error("Could not parse the statement into transactions.");
  }
  return res.parsed_output.transactions;
}

/**
 * Parse pasted/uploaded statement text into structured transactions with Claude.
 * Large inputs are auto-chunked so the structured JSON never truncates.
 */
export async function parseStatement(input: {
  text: string;
  categoryNames: string[];
}): Promise<ParsedTxn[]> {
  const categories = [...input.categoryNames, UNCATEGORIZED];
  const chunks = splitChunks(input.text);

  const results: ParsedTxn[] = [];
  for (const chunk of chunks) {
    results.push(...(await parseChunk(chunk, categories)));
  }
  return results;
}
