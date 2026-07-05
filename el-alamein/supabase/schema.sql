create table if not exists public.el_alamein_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{4,8}$'),
  state jsonb not null,
  players jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.el_alamein_rooms enable row level security;

drop policy if exists "el_alamein_rooms_select" on public.el_alamein_rooms;
drop policy if exists "el_alamein_rooms_insert" on public.el_alamein_rooms;
drop policy if exists "el_alamein_rooms_update" on public.el_alamein_rooms;

create policy "el_alamein_rooms_select"
  on public.el_alamein_rooms
  for select
  to anon, authenticated
  using (true);

create policy "el_alamein_rooms_insert"
  on public.el_alamein_rooms
  for insert
  to anon, authenticated
  with check (true);

create policy "el_alamein_rooms_update"
  on public.el_alamein_rooms
  for update
  to anon, authenticated
  using (true)
  with check (true);

create index if not exists el_alamein_rooms_updated_at_idx
  on public.el_alamein_rooms (updated_at desc);

do $$
begin
  alter publication supabase_realtime add table public.el_alamein_rooms;
exception
  when duplicate_object then null;
end $$;
