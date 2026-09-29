-- Migration: Kommentarfunktion pro Issue (mit einer Antwort-Ebene)
-- Ausfuehren unter: Supabase Dashboard -> SQL Editor -> New query -> Run

create table if not exists issue_comments (
  id bigint generated always as identity primary key,
  issue_id bigint not null references issues(id) on delete cascade,
  parent_id bigint references issue_comments(id) on delete cascade,
  author text not null,
  comment text not null,
  created_at timestamptz not null default now()
);

alter table issue_comments enable row level security;

create policy "Public read comments" on issue_comments
  for select using (true);

create policy "Public insert comments" on issue_comments
  for insert with check (true);
