-- Migration: Change-Log / History pro Issue
-- Ausfuehren unter: Supabase Dashboard -> SQL Editor -> New query -> Run

create table if not exists issue_history (
  id bigint generated always as identity primary key,
  issue_id bigint not null references issues(id) on delete cascade,
  event text not null,
  actor text,
  comment text,
  created_at timestamptz not null default now()
);

alter table issue_history enable row level security;

create policy "Public read history" on issue_history
  for select using (true);

create policy "Public insert history" on issue_history
  for insert with check (true);
