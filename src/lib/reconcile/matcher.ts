// Pure reconciliation matcher — no I/O, no server-only, fully unit-testable.
//
// When a statement is imported, each incoming ("feed") row is compared against
// the user's open provisional ("manual") entries on three axes — amount, date,
// and fuzzy merchant — and sorted into confidence tiers (see PRD §6.7):
//   high   → auto-merge silently (feed wins facts, manual wins meaning)
//   medium → surface as a proposed match for the user to confirm
//   low    → no match; both entries stand
//
// The feed amount is authoritative, but a merge records the manual's original
// ("logged") amount so downstream code can flag drift (e.g. a $20 pre-auth that
// posts as $120 after tip).

export type MatchTier = "high" | "medium" | "low";

/** Minimal shape the matcher needs from a transaction (feed or manual). */
export type MatchCandidate = {
  id: string;
  occurred_date: string; // YYYY-MM-DD
  amount: number; // signed (+ in, - out)
  type: string; // income | expense | transfer | savings
  merchant: string | null;
};

export type MatchResult = {
  feedId: string;
  manualId: string;
  tier: MatchTier;
  score: number; // 0..1 overall confidence
  amountDelta: number; // |feed| - |manual|, signed (feed minus manual magnitude)
  dayGap: number; // absolute days between the two dates
};

// Tunables. Date window from PRD (7 days); the rest are conservative so that
// only genuinely-confident pairs auto-merge.
const DATE_WINDOW_DAYS = 7;
const HIGH_MAX_DAYS = 5;
const HIGH_AMOUNT_PCT = 0.02; // within 2% (or the abs floor below)
const HIGH_AMOUNT_ABS = 1; // ...or within $1, whichever is larger
const MEDIUM_AMOUNT_PCT = 0.15; // pending→posted / tip drift still worth surfacing
const HIGH_MERCHANT = 0.8;
const MEDIUM_MERCHANT = 0.5;

/**
 * Lowercase, drop apostrophes (so "Joe's" → "joes", not "joe s"), turn any
 * other non-alphanumeric run into a space, collapse + trim.
 */
export function normalizeMerchant(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Meaningful tokens: drop pure-number (store #) and single-char noise, unless
 * that would empty the set. */
function tokens(raw: string | null | undefined): string[] {
  const all = normalizeMerchant(raw).split(" ").filter(Boolean);
  const meaningful = all.filter((t) => t.length > 1 && !/^\d+$/.test(t));
  return meaningful.length ? meaningful : all;
}

/** Two tokens match if equal or one is a prefix of the other (≥4 chars, so
 * "joes"/"joe" and "cafe"/"cafeteria" match but short noise doesn't). */
function tokenEq(x: string, y: string): boolean {
  if (x === y) return true;
  return x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x));
}

/**
 * Fuzzy merchant similarity in [0,1]. Token-based so store numbers and cruft
 * ("TRADER JOE'S #123") don't sink an otherwise-clear match against "Trader
 * Joes". Returns 1 when every token of the smaller side finds a partner in the
 * larger (full containment), otherwise a Jaccard-style overlap.
 */
export function merchantScore(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const [small, large] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const usedLarge = new Set<number>();
  let matched = 0;
  for (const s of small) {
    for (let i = 0; i < large.length; i++) {
      if (usedLarge.has(i)) continue;
      if (tokenEq(s, large[i])) {
        matched++;
        usedLarge.add(i);
        break;
      }
    }
  }

  if (matched === small.length) return 1; // smaller side fully contained
  const union = ta.length + tb.length - matched;
  return matched / union;
}

function dayGap(a: string, b: string): number {
  const ms = Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`));
  return Math.round(ms / 86_400_000);
}

/**
 * Classify a single feed↔manual pair. Returns null when they can't be the same
 * transaction (type mismatch or outside the date window).
 */
export function classifyPair(
  feed: MatchCandidate,
  manual: MatchCandidate,
): MatchResult | null {
  if (feed.type !== manual.type) return null;

  const gap = dayGap(feed.occurred_date, manual.occurred_date);
  if (gap > DATE_WINDOW_DAYS) return null;

  const feedMag = Math.abs(feed.amount);
  const manualMag = Math.abs(manual.amount);
  const amountDelta = feedMag - manualMag;
  const amountPct = Math.abs(amountDelta) / Math.max(1, manualMag);
  const amountAbs = Math.abs(amountDelta);

  const merch = merchantScore(feed.merchant, manual.merchant);

  const amountHigh =
    amountAbs <= HIGH_AMOUNT_ABS || amountPct <= HIGH_AMOUNT_PCT;
  const amountMedium = amountPct <= MEDIUM_AMOUNT_PCT;

  let tier: MatchTier = "low";
  if (merch >= HIGH_MERCHANT && amountHigh && gap <= HIGH_MAX_DAYS) {
    tier = "high";
  } else if (
    (merch >= MEDIUM_MERCHANT && amountMedium) ||
    (merch >= HIGH_MERCHANT && amountMedium)
  ) {
    tier = "medium";
  }

  // Overall confidence: merchant, amount closeness, and date proximity blended.
  const amountScore = Math.max(0, 1 - amountPct / MEDIUM_AMOUNT_PCT);
  const dateScore = Math.max(0, 1 - gap / DATE_WINDOW_DAYS);
  const score = 0.5 * merch + 0.35 * amountScore + 0.15 * dateScore;

  return { feedId: feed.id, manualId: manual.id, tier, score, amountDelta, dayGap: gap };
}

/**
 * Match a batch of freshly-imported feed rows against open manual entries.
 * Greedy and one-to-one: each manual is consumed by at most one feed row (its
 * best available match), best-scoring pairs first. Low-tier pairs are dropped.
 */
export function matchImported(
  feed: MatchCandidate[],
  manuals: MatchCandidate[],
): MatchResult[] {
  const pairs: MatchResult[] = [];
  for (const f of feed) {
    for (const m of manuals) {
      const r = classifyPair(f, m);
      if (r && r.tier !== "low") pairs.push(r);
    }
  }

  // Strongest matches win the assignment; each feed row and each manual used once.
  pairs.sort((a, b) => {
    const rank = tierRank(b.tier) - tierRank(a.tier);
    return rank !== 0 ? rank : b.score - a.score;
  });

  const usedFeed = new Set<string>();
  const usedManual = new Set<string>();
  const chosen: MatchResult[] = [];
  for (const p of pairs) {
    if (usedFeed.has(p.feedId) || usedManual.has(p.manualId)) continue;
    usedFeed.add(p.feedId);
    usedManual.add(p.manualId);
    chosen.push(p);
  }
  return chosen;
}

function tierRank(t: MatchTier): number {
  return t === "high" ? 2 : t === "medium" ? 1 : 0;
}
