// Client-safe shared enums + labels (no "server-only" — imported by forms too).

export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit_card",
  "brokerage",
  "loan",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit card",
  brokerage: "Brokerage",
  loan: "Loan",
};

export const TXN_TYPES = [
  "income",
  "expense",
  "transfer",
  "savings",
] as const;

export type TxnType = (typeof TXN_TYPES)[number];

export const TXN_TYPE_LABELS: Record<TxnType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  savings: "Savings",
};
