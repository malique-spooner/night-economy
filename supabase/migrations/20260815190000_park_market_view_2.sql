-- Market View 2 is parked. Its read-only history function is no longer part of
-- the production surface and can be recreated from the earlier migration if
-- the concept is approved again.
drop function if exists public.market_product_price_history(text, text[], integer);
