alter table public.market_runs
  drop constraint if exists market_runs_kind_check;

alter table public.market_runs
  add constraint market_runs_kind_check
  check (kind in ('quick', 'instant', 'scheduled'));
