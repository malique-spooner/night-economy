alter table public.venues
  alter column crash_settings
  set default '{"durationMinutes":10,"categoryCrashCounts":{}}'::jsonb;
