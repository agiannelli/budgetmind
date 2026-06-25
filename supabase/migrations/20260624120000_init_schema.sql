-- ============================================================================
-- BudgetMind — initial schema (PR 2)
-- Implements the data model from BudgetMind_PRD.md v0.2.
--
-- Design commitments baked in here (expensive to retrofit, so built now):
--   • user_id on every owned row  -> multi-user *seam*, no multi-user features
--   • transaction provenance + reconciliation (source/status/superseded_by)
--   • single envelopes table = the whole assigned layer (goals folded in)
--   • allocations ledger = the bidirectional engine (fills + coverage pulls)
--   • two-layer profile: profile_config/matching_rules (code) + profile_memory (Claude)
--
-- RLS: enabled + DENY-ALL on every owned table. The app accesses Postgres via the
-- service role (which bypasses RLS) and enforces user_id in code. When Auth0 JWTs
-- are later wired into Supabase, add per-table policies keyed off the `sub` claim —
-- a non-breaking upgrade, since the user_id columns already exist.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 0. Enums
-- ----------------------------------------------------------------------------
create type txn_type        as enum ('income','expense','transfer','savings');
create type txn_source      as enum ('manual','imported','plaid');
create type txn_status      as enum ('unconfirmed','needs_review','confirmed');
create type txn_fidelity    as enum ('backfill','current');      -- light-touch vs careful
create type account_type    as enum ('checking','savings','credit_card','brokerage','loan');
create type cadence         as enum ('weekly','monthly','quarterly','annual','seasonal','custom');

-- behavior-driven; the event's `name` carries the specific flavor
create type event_kind      as enum (
  'property_tax',            -- reserve + lead-time alert
  'estimated_tax_payment',   -- reserve + lead-time alert (quarterly)
  'insurance_premium',       -- reserve + lead-time alert (annual/semiannual)
  'vest',                    -- windfall waterfall
  'bonus',                   -- windfall waterfall
  'share_sale',              -- LTCG reserve (estimated_tax)
  'tax_refund',              -- inbound windfall
  'loan_payoff',             -- baseline drops (transition tracker)
  'home_closing',            -- baseline drops
  'large_planned_purchase',  -- lead-time alert / sinking fund
  'other'
);
create type event_status    as enum ('upcoming','occurred','cancelled');

-- kept deliberately SMALL & behavior-driven; "Subscriptions"/"Utilities" are just
-- named sinking_funds (topical granularity lives in `categories`, not here)
create type envelope_kind   as enum ('emergency_fund','invest','tax_reserve','sinking_fund','custom');

-- how an envelope is funded / what "on track" means for it
create type funding_type    as enum (
  'build_to_target',   -- accumulate toward target_amount, optionally by target_date
  'monthly_fund',      -- a static recurring set-aside (monthly_contribution)
  'refill_to_cap'      -- a spending bucket refilled to a ceiling each period
);
create type coverage_tier   as enum ('untouchable','flag_to_borrow','flex');  -- robbability

create type alloc_source    as enum ('windfall','scheduled_contribution','coverage_pull','manual_adjust');
create type alloc_status    as enum ('proposed','approved','rejected');
create type band_scope      as enum ('overall','category');
create type checkin_trigger as enum ('on_demand','event','nudge','scheduled');
create type change_target   as enum ('config','memory','envelope','coverage_policy','matching_rule');
create type change_status   as enum ('proposed','approved','rejected');

-- ----------------------------------------------------------------------------
-- Shared helper: keep updated_at fresh
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. Scoping
-- ----------------------------------------------------------------------------
create table users (
  id         uuid primary key default gen_random_uuid(),
  auth0_sub  text unique not null,
  email      text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Money sources
-- ----------------------------------------------------------------------------
create table accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  name             text not null,                 -- as provided by bank/feed
  nickname         text,                          -- user label; display falls back to name
  type             account_type not null,
  institution      text,
  currency         char(3) not null default 'USD',
  plaid_account_id text,                           -- null until Phase 2
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index on accounts (user_id);

create table categories (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  name             text not null,
  kind             txn_type not null,             -- maps to transaction.type
  is_discretionary boolean not null default false, -- participates in the band
  parent_id        uuid references categories(id) on delete set null,
  is_active        boolean not null default true,
  unique (user_id, name)
);
create index on categories (user_id);

-- ----------------------------------------------------------------------------
-- 3. Transactions + reconciliation (load-bearing)
-- ----------------------------------------------------------------------------
create table transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,

  occurred_date date not null,                    -- when it happened (manual logs this)
  posted_date   date,                             -- when the feed posted it
  amount        numeric(14,2) not null,           -- SIGNED: + in, - out
  type          txn_type not null,
  is_excluded_from_spending boolean not null default false,  -- transfers/savings

  merchant_raw        text,
  merchant_normalized text,
  category_id         uuid references categories(id) on delete set null,
  notes               text,

  -- provenance
  source   txn_source   not null,
  status   txn_status   not null default 'unconfirmed',
  fidelity txn_fidelity not null default 'current',

  -- idempotent imports
  external_id text,                               -- plaid transaction_id
  import_hash text,                               -- content hash for statement rows
  is_pending  boolean not null default false,     -- plaid pending -> posted

  -- reconciliation
  superseded_by uuid references transactions(id) on delete set null,  -- set on the losing (manual) row
  logged_amount numeric(14,2),                    -- manual's original amount, to detect drift on merge

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, external_id),                  -- plaid dedupe
  unique (user_id, import_hash)                    -- statement dedupe
);
-- Aggregates (safe-to-spend, band stats) filter on superseded_by is null.
create index on transactions (user_id, occurred_date) where superseded_by is null;
create index on transactions (account_id);
create index on transactions (category_id);
create trigger trg_transactions_updated before update on transactions
  for each row execute function set_updated_at();

-- Medium-confidence proposed matches awaiting confirm (high = auto-merge, low = none)
create table transaction_matches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  manual_txn_id    uuid not null references transactions(id) on delete cascade,
  candidate_txn_id uuid not null references transactions(id) on delete cascade,
  confidence       numeric(4,3) not null,         -- 0..1
  signals          jsonb,                         -- {amount_delta, days_apart, merchant_score}
  status           change_status not null default 'proposed',
  created_at       timestamptz not null default now()
);
create index on transaction_matches (user_id, status);

-- ----------------------------------------------------------------------------
-- 4. Forward-looking inputs
-- ----------------------------------------------------------------------------
create table recurring_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  account_id      uuid references accounts(id) on delete set null,
  name            text not null,
  category_id     uuid references categories(id) on delete set null,
  type            txn_type not null,
  cadence         cadence not null,
  expected_amount numeric(14,2),                  -- signed
  amount_min      numeric(14,2),
  amount_max      numeric(14,2),
  next_due_date   date,
  is_active       boolean not null default true,
  notes           text
);
create index on recurring_items (user_id);

create table timed_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  name            text not null,                  -- the specific flavor
  kind            event_kind not null,
  event_date      date not null,
  expected_amount numeric(14,2),                  -- signed cash impact
  estimated_tax   numeric(14,2),                  -- LTCG reserve for kind='share_sale'
  status          event_status not null default 'upcoming',
  notes           text,
  created_at      timestamptz not null default now()
);
create index on timed_events (user_id, event_date);

-- ----------------------------------------------------------------------------
-- 5. Assigned layer (envelopes) + the bidirectional engine
-- ----------------------------------------------------------------------------
create table envelopes (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,
  name                 text not null,
  kind                 envelope_kind not null,
  funding_type         funding_type not null default 'build_to_target',
  priority             int not null,              -- waterfall fill + coverage order
  target_amount        numeric(14,2),             -- build_to_target ceiling
  target_months        numeric(5,2),              -- EF as months of expenses (alt to target_amount)
  target_date          date,                      -- "by October"; null = open-ended
  monthly_contribution numeric(14,2),             -- monthly_fund amount
  current_balance      numeric(14,2) not null default 0,  -- derived from approved allocations
  is_protected         boolean not null default false,    -- floor
  coverage             coverage_tier not null default 'flex',
  is_active            boolean not null default true,
  notes                text,
  unique (user_id, priority)                      -- NOTE: reorder = swap priorities
);
create index on envelopes (user_id);

-- Ledger: every fill AND every coverage pull, all propose-then-confirm
create table allocations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  envelope_id      uuid not null references envelopes(id) on delete cascade,
  amount           numeric(14,2) not null,        -- SIGNED: + fill, - pull
  source_kind      alloc_source not null,
  related_event_id uuid references timed_events(id) on delete set null,
  related_txn_id   uuid references transactions(id) on delete set null,
  rationale        text,                          -- the assistant's plain-English "why"
  status           alloc_status not null default 'proposed',
  approved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index on allocations (user_id, envelope_id) where status = 'approved';

-- ----------------------------------------------------------------------------
-- 6. Discretionary band (NOT an envelope)
-- ----------------------------------------------------------------------------
create table spending_bands (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  scope         band_scope not null,             -- overall = hero, category = soft
  category_id   uuid references categories(id) on delete cascade,
  stat_median   numeric(14,2),
  stat_spread   numeric(14,2),
  lower_bound   numeric(14,2),
  upper_bound   numeric(14,2),
  computed_from date,                             -- start of the window used
  computed_at   timestamptz not null default now(),
  is_soft       boolean not null default false
);
create index on spending_bands (user_id, scope);

-- ----------------------------------------------------------------------------
-- 7. Two-layer profile + learning
-- ----------------------------------------------------------------------------
-- (a) structured config — code reads & executes
create table profile_config (
  user_id         uuid primary key references users(id) on delete cascade,
  coverage_policy jsonb not null default '[]',    -- ordered fallback list
  tax_settings    jsonb not null default '{}',    -- {ltcg_rate_estimate, property_tax}
  band_settings   jsonb not null default '{}',    -- {spread_method, match_window_days, drift_threshold}
  updated_at      timestamptz not null default now()
);
create trigger trg_profile_config_updated before update on profile_config
  for each row execute function set_updated_at();

-- importer's deterministic identifier rules
create table matching_rules (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  label              text not null,              -- "April bonus", "RSU vest transfer"
  match_type         text not null,              -- income_identifier | merchant_alias | event_identifier
  pattern            jsonb not null,             -- {substring/regex, amount_min, amount_max, account_id}
  target_category_id uuid references categories(id) on delete set null,
  target_event_kind  event_kind,
  priority           int not null default 100,
  is_active          boolean not null default true
);
create index on matching_rules (user_id, is_active);

-- (b) narrative memory — Claude reads for judgment/phrasing
create table profile_memory (
  user_id    uuid primary key references users(id) on delete cascade,
  content    text not null default '',           -- markdown
  version    int  not null default 1,
  updated_at timestamptz not null default now()
);
create trigger trg_profile_memory_updated before update on profile_memory
  for each row execute function set_updated_at();

create table profile_memory_revisions (          -- history, for diffing
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  version    int  not null,
  content    text not null,
  created_at timestamptz not null default now()
);
create index on profile_memory_revisions (user_id, version);

-- ----------------------------------------------------------------------------
-- 8. Check-ins + approved diffs
-- ----------------------------------------------------------------------------
create table check_ins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  period_start date,
  period_end   date,
  triggered_by checkin_trigger not null,
  summary      text,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index on check_ins (user_id, created_at);

create table profile_changes (                    -- the approved diffs from learning
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  check_in_id uuid references check_ins(id) on delete set null,
  target      change_target not null,
  before      jsonb,
  after       jsonb,
  status      change_status not null default 'proposed',
  applied_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index on profile_changes (user_id, status);

-- ----------------------------------------------------------------------------
-- 9. RLS — enable + DENY-ALL (service role bypasses; add Auth0-JWT policies later)
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'users','accounts','categories','transactions','transaction_matches',
    'recurring_items','timed_events','envelopes','allocations','spending_bands',
    'profile_config','matching_rules','profile_memory','profile_memory_revisions',
    'check_ins','profile_changes'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 10. Per-user default seeding (call on signup; trigger provided below)
--     Graceful onboarding: a "quick" onboarding could seed a leaner set.
-- ----------------------------------------------------------------------------
create or replace function seed_user_defaults(p_user_id uuid)
returns void language plpgsql as $$
begin
  -- two-layer profile rows
  insert into profile_config (user_id) values (p_user_id) on conflict do nothing;
  insert into profile_memory (user_id) values (p_user_id) on conflict do nothing;

  -- default categories (topical granularity = inspiration when reviewing transactions)
  insert into categories (user_id, name, kind, is_discretionary) values
    -- income
    (p_user_id,'Salary','income',false),
    (p_user_id,'Bonus','income',false),
    (p_user_id,'RSU/Equity','income',false),
    (p_user_id,'Interest','income',false),
    (p_user_id,'Refund','income',false),
    (p_user_id,'Other Income','income',false),
    -- housing
    (p_user_id,'Mortgage','expense',false),
    (p_user_id,'Property Tax','expense',false),
    (p_user_id,'Home Insurance','expense',false),
    (p_user_id,'Home Repairs','expense',false),
    (p_user_id,'Utilities','expense',false),
    -- recurring
    (p_user_id,'Subscriptions','expense',false),
    (p_user_id,'Phone & Internet','expense',false),
    (p_user_id,'Insurance','expense',false),
    -- daily
    (p_user_id,'Groceries','expense',false),
    (p_user_id,'Dining','expense',true),
    (p_user_id,'Fuel','expense',false),
    (p_user_id,'Transport','expense',false),
    (p_user_id,'Household','expense',false),
    -- lifestyle (the flexible band lives mostly here)
    (p_user_id,'Hobbies','expense',true),
    (p_user_id,'Shopping','expense',true),
    (p_user_id,'Entertainment','expense',true),
    (p_user_id,'Travel','expense',true),
    -- health
    (p_user_id,'Medical','expense',false),
    (p_user_id,'Pharmacy','expense',false),
    (p_user_id,'Fitness','expense',false),
    -- financial
    (p_user_id,'Fees','expense',false),
    (p_user_id,'Taxes','expense',false),
    (p_user_id,'Transfer','transfer',false),
    (p_user_id,'Savings','savings',false),
    (p_user_id,'Invest','savings',false)
  on conflict (user_id, name) do nothing;

  -- default envelopes (the protected floor + the two non-negotiables)
  insert into envelopes
    (user_id, name, kind, funding_type, priority, is_protected, coverage, target_months) values
    (p_user_id,'Emergency Fund','emergency_fund','build_to_target',1,true,'untouchable',6)
  on conflict (user_id, priority) do nothing;

  insert into envelopes
    (user_id, name, kind, funding_type, priority, is_protected, coverage) values
    (p_user_id,'Tax Reserve','tax_reserve','build_to_target',2,true,'untouchable')
  on conflict (user_id, priority) do nothing;

  insert into envelopes
    (user_id, name, kind, funding_type, priority, is_protected, coverage, monthly_contribution) values
    (p_user_id,'Invest','invest','monthly_fund',3,false,'flag_to_borrow',0)
  on conflict (user_id, priority) do nothing;
end;
$$;

-- Auto-seed on user creation. Drop this trigger if you'd rather seed explicitly
-- from the app (e.g. to branch on a "quick" vs "full" onboarding path).
create or replace function handle_new_user() returns trigger
language plpgsql as $$
begin
  perform seed_user_defaults(new.id);
  return new;
end;
$$;
create trigger trg_seed_new_user after insert on users
  for each row execute function handle_new_user();
