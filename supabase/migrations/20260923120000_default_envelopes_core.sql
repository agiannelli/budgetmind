-- Broaden the default envelope set seeded for new users.
--
-- The original seed shipped three envelopes (Emergency Fund, Tax Reserve,
-- Invest). We now seed a "universal core" of five that apply to almost everyone
-- and demonstrate the range of envelope jobs (a floor, a smoothed annual bill,
-- and three sinking funds). The more assumption-heavy envelopes — Tax Reserve,
-- Auto, Home, Invest — are offered in-app as one-tap "Suggested envelopes"
-- rather than seeded, so no one starts by deleting.
--
-- Only the envelope block changed; categories and profile rows are unchanged.
-- Existing users are unaffected (this only runs on user creation).

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

  -- default envelopes: the universal core (one floor + one smoothed annual bill
  -- + three sinking funds). Assumption-heavy envelopes are offered in-app.
  insert into envelopes
    (user_id, name, kind, funding_type, priority, is_protected, coverage, target_months) values
    (p_user_id,'Emergency Fund','emergency_fund','build_to_target',1,true,'untouchable',6)
  on conflict (user_id, priority) do nothing;

  insert into envelopes
    (user_id, name, kind, funding_type, priority, is_protected, coverage, monthly_contribution) values
    (p_user_id,'Annual Bills & Insurance','sinking_fund','monthly_fund',2,false,'flag_to_borrow',0)
  on conflict (user_id, priority) do nothing;

  insert into envelopes
    (user_id, name, kind, funding_type, priority, is_protected, coverage) values
    (p_user_id,'Health & Medical','sinking_fund','build_to_target',3,false,'flex')
  on conflict (user_id, priority) do nothing;

  insert into envelopes
    (user_id, name, kind, funding_type, priority, is_protected, coverage) values
    (p_user_id,'Travel','sinking_fund','build_to_target',4,false,'flex')
  on conflict (user_id, priority) do nothing;

  insert into envelopes
    (user_id, name, kind, funding_type, priority, is_protected, coverage) values
    (p_user_id,'Gifts & Holidays','sinking_fund','refill_to_cap',5,false,'flex')
  on conflict (user_id, priority) do nothing;
end;
$$;
