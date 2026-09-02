-- Each venue chooses which TV story labels can appear beside its market board.
-- The defaults intentionally favour easing prices, then featured, steady and
-- finally rising stories so the screen does not overstate price increases.
alter table public.venues
  add column if not exists tv_story_article_ids jsonb not null default '["easing-1","easing-2","easing-3","easing-6","easing-7","easing-8","easing-10","easing-14","featured-1","featured-2","featured-7","featured-8","featured-14","featured-15","steady-1","steady-2","steady-3","steady-6","steady-8","rising-1","rising-2","rising-10"]'::jsonb;

do $$
begin
  alter table public.venues
    add constraint venues_tv_story_article_ids_array
    check (jsonb_typeof(tv_story_article_ids) = 'array');
exception
  when duplicate_object then null;
end $$;

grant update (tv_story_article_ids) on public.venues to authenticated;
