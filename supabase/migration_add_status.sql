-- Migration: expliziter Status (open / in_progress / resolved)
-- Ausfuehren unter: Supabase Dashboard -> SQL Editor -> New query -> Run

alter table issues
  add column if not exists status text not null default 'open';

update issues set status = 'resolved' where resolved = true and status <> 'resolved';

alter table issues
  drop constraint if exists issues_status_check;

alter table issues
  add constraint issues_status_check check (status in ('open', 'in_progress', 'resolved'));
