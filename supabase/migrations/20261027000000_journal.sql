create table if not exists public.journal_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  frequency text not null default 'week' check (frequency in ('week', 'month')),
  updated_at timestamptz not null default now()
);
create table if not exists public.watched_games (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (length(game_id) between 1 and 100),
  record jsonb not null check (
    jsonb_typeof(record) = 'object'
    and record->>'gameId' = game_id
    and length(coalesce(record->>'note', '')) <= 1000
    and (record->'photos' is null or (jsonb_typeof(record->'photos') = 'array' and jsonb_array_length(record->'photos') <= 3))
  ),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
create table if not exists public.diaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('week', 'month')),
  from_date date not null,
  to_date date not null,
  diary jsonb not null check (jsonb_typeof(diary) = 'object' and length(coalesce(diary->>'text', '')) <= 20000),
  created_at timestamptz not null default now(),
  primary key (user_id, period, from_date)
);

alter table public.journal_profiles enable row level security;
alter table public.watched_games enable row level security;
alter table public.diaries enable row level security;

create policy "Users read own journal profile" on public.journal_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "Users insert own journal profile" on public.journal_profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own journal profile" on public.journal_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users read own watched games" on public.watched_games for select to authenticated using (user_id = (select auth.uid()));
create policy "Users insert own watched games" on public.watched_games for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own watched games" on public.watched_games for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users delete own watched games" on public.watched_games for delete to authenticated using (user_id = (select auth.uid()));
create policy "Users read own diaries" on public.diaries for select to authenticated using (user_id = (select auth.uid()));
create policy "Users insert own diaries" on public.diaries for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own diaries" on public.diaries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-images', 'journal-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload own journal images" on storage.objects for insert to authenticated
with check (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users read own journal images" on storage.objects for select to authenticated
using (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own journal images" on storage.objects for delete to authenticated
using (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
