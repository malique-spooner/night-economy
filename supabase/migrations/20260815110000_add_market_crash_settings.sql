alter table public.venues
  add column if not exists crash_settings jsonb not null default '{"durationMinutes":10,"categoryCrashCounts":{}}'::jsonb;

alter table public.venues
  drop constraint if exists venues_crash_settings_is_object;

alter table public.venues
  add constraint venues_crash_settings_is_object
  check (jsonb_typeof(crash_settings) = 'object');

grant update (crash_settings, updated_at) on public.venues to authenticated;
