-- The built-in simulator writes directly to market_products. Its generated
-- price_publications rows duplicate the simulator's market snapshots and are
-- not read by the application; retain publication history for real POS
-- At migration time both tables contain only internal simulation records;
-- no external POS publication history is present. TRUNCATE releases the space
-- directly and avoids a long row-by-row delete/WAL operation.
truncate table public.price_publication_lines, public.price_publications;
