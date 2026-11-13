-- LAAGANAN: Supabase setup. Paste the whole file into SQL Editor and click Run (safe to run again).

-- 1) One generic table that stores every collection the app uses
create table if not exists public.docs (
  collection text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
alter table public.docs enable row level security;

-- 2) Admin list (filled in step "Make yourself admin" in the README)
create table if not exists public.admin_config (uid uuid primary key);
alter table public.admin_config enable row level security;   -- no policies: not readable from the app

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_config where uid = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 3) Partial update helper (merges fields into an existing document)
create or replace function public.doc_update(p_collection text, p_id text, p_patch jsonb) returns void
language sql security invoker as $$
  update public.docs set data = data || p_patch, updated_at = now()
  where collection = p_collection and id = p_id;
$$;

-- 4) Permissions
drop policy if exists docs_read_public  on public.docs;
drop policy if exists docs_read_private on public.docs;
drop policy if exists docs_admin_all    on public.docs;
drop policy if exists docs_own_insert   on public.docs;
drop policy if exists docs_own_update   on public.docs;

-- Everyone can read these collections
create policy docs_read_public on public.docs for select
  using (collection in ('spots','lgu','weather','categories','userspots','photos'));

-- Accounts and trips: only the owner (and the admin) can read
create policy docs_read_private on public.docs for select
  using (collection in ('accounts','trips') and id = auth.uid()::text);

-- The admin can do everything (including the private 'config' collection)
create policy docs_admin_all on public.docs for all
  using (public.is_admin()) with check (public.is_admin());

-- Each user can write only their own document in these collections
create policy docs_own_insert on public.docs for insert
  with check (collection in ('userspots','photos','accounts','trips') and id = auth.uid()::text);
create policy docs_own_update on public.docs for update
  using      (collection in ('userspots','photos','accounts','trips') and id = auth.uid()::text)
  with check (collection in ('userspots','photos','accounts','trips') and id = auth.uid()::text);

-- 5) Live updates
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 6) Photo storage: public bucket, images only, 5 MB each
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 5242880, array['image/*'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/*'];

drop policy if exists "laaganan upload" on storage.objects;
create policy "laaganan upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads');

-- 7) Make yourself admin AFTER you know your user ID (see README), then run:
-- insert into public.admin_config (uid) values ('PASTE-YOUR-USER-ID-HERE');
