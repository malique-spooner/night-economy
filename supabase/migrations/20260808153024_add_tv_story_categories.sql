alter table public.venues
  add column if not exists tv_story_categories jsonb not null default '["Cocktails"]'::jsonb;

do $$
begin
  alter table public.venues
    add constraint venues_tv_story_categories_array
    check (jsonb_typeof(tv_story_categories) = 'array' and jsonb_array_length(tv_story_categories) > 0);
exception
  when duplicate_object then null;
end $$;

grant update (tv_story_categories) on public.venues to authenticated;
