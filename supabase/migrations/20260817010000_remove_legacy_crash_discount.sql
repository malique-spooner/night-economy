-- Crash depth is derived from each drink's floor, so there is no separate
-- percentage setting to drift out of sync with the pricing engine.
alter table public.venues
  alter column crash_settings
  set default '{"durationMinutes":10,"categoryCrashCounts":{}}'::jsonb;

update public.venues
set crash_settings = crash_settings - 'discountPercent'
where crash_settings ? 'discountPercent';
