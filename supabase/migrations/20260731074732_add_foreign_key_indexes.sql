-- PostgreSQL does not index referencing columns automatically. These indexes
-- keep venue-scoped reads, joins, and cascading deletes efficient as POS and
-- run-history tables grow.
create index if not exists audit_log_venue_id_idx
  on public.audit_log (venue_id);

create index if not exists market_price_snapshots_venue_id_idx
  on public.market_price_snapshots (venue_id);

create index if not exists pos_products_venue_id_idx
  on public.pos_products (venue_id);

create index if not exists pos_sales_events_pos_connection_id_idx
  on public.pos_sales_events (pos_connection_id);

create index if not exists pos_sales_events_pos_product_id_idx
  on public.pos_sales_events (pos_product_id);

create index if not exists price_publication_lines_market_product_id_idx
  on public.price_publication_lines (market_product_id);

create index if not exists price_publication_lines_pos_product_id_idx
  on public.price_publication_lines (pos_product_id);

create index if not exists price_publication_lines_publication_id_idx
  on public.price_publication_lines (publication_id);

create index if not exists price_publications_pos_connection_id_idx
  on public.price_publications (pos_connection_id);

create index if not exists price_publications_venue_id_idx
  on public.price_publications (venue_id);

create index if not exists venue_test_services_active_run_id_idx
  on public.venue_test_services (active_run_id);
