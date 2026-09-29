-- Migration: Resolve-Workflow (wer/wann/Kommentar)
-- Nur noetig, wenn issues-Tabelle bereits VOR diesem Feature angelegt wurde
-- (schema.sql enthaelt die Spalten inzwischen direkt).
-- Ausfuehren unter: Supabase Dashboard -> SQL Editor -> New query -> Run

alter table issues
  add column if not exists resolved_by text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_comment text;
