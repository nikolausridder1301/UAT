-- UAT Issue Log: Datenbank-Setup fuer Supabase
-- Ausfuehren unter: Supabase Dashboard -> SQL Editor -> New query -> Run

-- Tabelle fuer die Issues
create table if not exists issues (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  date date not null default current_date,
  reported_by text not null,
  issue_explained text not null,
  why text,
  owner text not null,
  resolved boolean not null default false,
  screenshot_urls text[] not null default '{}',
  agent text not null default 'COM',
  resolved_by text,
  resolved_at timestamptz,
  resolution_comment text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved'))
);

-- Row Level Security aktivieren
alter table issues enable row level security;

-- Offener Zugriff (kein Login): jeder mit dem Link darf lesen, hinzufuegen,
-- den Resolved-Status aendern und Eintraege loeschen.
create policy "Public read" on issues
  for select using (true);

create policy "Public insert" on issues
  for insert with check (true);

create policy "Public update" on issues
  for update using (true);

create policy "Public delete" on issues
  for delete using (true);

-- Storage-Bucket fuer Screenshots
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

create policy "Public read screenshots" on storage.objects
  for select using (bucket_id = 'screenshots');

create policy "Public upload screenshots" on storage.objects
  for insert with check (bucket_id = 'screenshots');

create policy "Public delete screenshots" on storage.objects
  for delete using (bucket_id = 'screenshots');
