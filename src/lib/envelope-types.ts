// Client-safe envelope enums, labels, and types (no "server-only" — imported by
// both the server data layer and client components).

export const ENVELOPE_KINDS = [
  "emergency_fund",
  "invest",
  "tax_reserve",
  "sinking_fund",
  "custom",
] as const;
export type EnvelopeKind = (typeof ENVELOPE_KINDS)[number];

export const ENVELOPE_KIND_LABELS: Record<EnvelopeKind, string> = {
  emergency_fund: "Emergency fund",
  invest: "Invest",
  tax_reserve: "Tax reserve",
  sinking_fund: "Sinking fund",
  custom: "Custom",
};

export const FUNDING_TYPES = [
  "build_to_target",
  "monthly_fund",
  "refill_to_cap",
] as const;
export type FundingType = (typeof FUNDING_TYPES)[number];

export const FUNDING_TYPE_LABELS: Record<FundingType, string> = {
  build_to_target: "Build to a target",
  monthly_fund: "Fixed monthly set-aside",
  refill_to_cap: "Refill to a cap each period",
};

export const COVERAGE_TIERS = ["untouchable", "flag_to_borrow", "flex"] as const;
export type CoverageTier = (typeof COVERAGE_TIERS)[number];

export const COVERAGE_TIER_LABELS: Record<CoverageTier, string> = {
  untouchable: "Untouchable",
  flag_to_borrow: "Borrow with a flag",
  flex: "Flexible",
};

export type Envelope = {
  id: string;
  name: string;
  kind: EnvelopeKind;
  funding_type: FundingType;
  priority: number;
  target_amount: number | null;
  target_months: number | null;
  target_date: string | null;
  monthly_contribution: number | null;
  current_balance: number;
  is_protected: boolean;
  coverage: CoverageTier;
  notes: string | null;
};

export type EnvelopeInput = {
  name: string;
  kind: EnvelopeKind;
  funding_type: FundingType;
  target_amount?: number | null;
  target_months?: number | null;
  target_date?: string | null;
  monthly_contribution?: number | null;
  current_balance?: number | null;
  is_protected: boolean;
  coverage: CoverageTier;
  notes?: string | null;
};
