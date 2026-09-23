-- One-off large purchases shouldn't inflate the recurring monthly-spend
-- baseline used to size goals like the emergency fund. This flag lets the user
-- mark such purchases as excluded from that baseline. It's distinct from
-- is_excluded_from_spending (transfers/savings, which aren't spending at all):
-- an excluded-from-baseline row is still real spending, just not recurring.

alter table transactions
  add column if not exists exclude_from_baseline boolean not null default false;

comment on column transactions.exclude_from_baseline is
  'True for one-off purchases the user excluded from the recurring monthly-spend baseline (still real spending, unlike is_excluded_from_spending).';
