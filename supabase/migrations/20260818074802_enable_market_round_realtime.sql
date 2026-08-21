do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'market_price_snapshots'
  ) then
    alter publication supabase_realtime add table public.market_price_snapshots;
  end if;
end $$;
