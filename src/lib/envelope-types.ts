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

/**
 * The standard envelope catalog. The `core` entries are seeded for new accounts
 * (see the seed migration); every entry is also offered in-app as a one-tap
 * "Suggested envelope" for any that the user doesn't already have — so existing
 * users can pick up the rest without a forced insert.
 */
export type EnvelopePreset = {
  key: string;
  name: string;
  kind: EnvelopeKind;
  funding_type: FundingType;
  coverage: CoverageTier;
  is_protected: boolean;
  target_months?: number | null;
  monthly_contribution?: number | null;
  core: boolean;
  blurb: string;
};

export const ENVELOPE_CATALOG: EnvelopePreset[] = [
  {
    key: "emergency_fund",
    name: "Emergency Fund",
    kind: "emergency_fund",
    funding_type: "build_to_target",
    coverage: "untouchable",
    is_protected: true,
    target_months: 6,
    core: true,
    blurb: "6 months of expenses",
  },
  {
    key: "annual_bills",
    name: "Annual Bills & Insurance",
    kind: "sinking_fund",
    funding_type: "monthly_fund",
    coverage: "flag_to_borrow",
    is_protected: false,
    monthly_contribution: 0,
    core: true,
    blurb: "Smooth yearly premiums & renewals",
  },
  {
    key: "health",
    name: "Health & Medical",
    kind: "sinking_fund",
    funding_type: "build_to_target",
    coverage: "flex",
    is_protected: false,
    core: true,
    blurb: "Deductible & out-of-pocket buffer",
  },
  {
    key: "travel",
    name: "Travel",
    kind: "sinking_fund",
    funding_type: "build_to_target",
    coverage: "flex",
    is_protected: false,
    core: true,
    blurb: "Trips & vacations",
  },
  {
    key: "gifts",
    name: "Gifts & Holidays",
    kind: "sinking_fund",
    funding_type: "refill_to_cap",
    coverage: "flex",
    is_protected: false,
    core: true,
    blurb: "Resets each year",
  },
  {
    key: "tax_reserve",
    name: "Tax Reserve",
    kind: "tax_reserve",
    funding_type: "build_to_target",
    coverage: "untouchable",
    is_protected: true,
    core: false,
    blurb: "For variable / 1099 income",
  },
  {
    key: "auto",
    name: "Auto & Transport",
    kind: "sinking_fund",
    funding_type: "refill_to_cap",
    coverage: "flex",
    is_protected: false,
    core: false,
    blurb: "Maintenance, repairs, registration",
  },
  {
    key: "home",
    name: "Home Maintenance",
    kind: "sinking_fund",
    funding_type: "refill_to_cap",
    coverage: "flex",
    is_protected: false,
    core: false,
    blurb: "Repairs & appliances",
  },
  {
    key: "invest",
    name: "Invest",
    kind: "invest",
    funding_type: "monthly_fund",
    coverage: "flag_to_borrow",
    is_protected: false,
    monthly_contribution: 0,
    core: false,
    blurb: "Monthly contribution",
  },
];
