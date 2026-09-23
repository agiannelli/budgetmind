-- Recurring items (quarterly taxes, yearly insurance, monthly bills) need a
-- stable key to match their real transactions, so those transactions can be
-- pulled out of the variable-spend average and replaced by the item's amortized
-- monthly-equivalent (no double-counting). We match on a normalized merchant
-- string, kept separate from the display name so the user can rename freely.

alter table recurring_items
  add column if not exists match_merchant text;

comment on column recurring_items.match_merchant is
  'Normalized merchant string used to match this recurring item to its transactions (independent of the display name).';
