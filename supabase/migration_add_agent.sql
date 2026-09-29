-- Migration: Spalte "agent" nachtraeglich hinzufuegen
-- Nur noetig, wenn issues-Tabelle bereits VOR Einfuehrung des Agent-Felds
-- angelegt wurde (schema.sql enthaelt die Spalte inzwischen direkt).
-- Ausfuehren unter: Supabase Dashboard -> SQL Editor -> New query -> Run

alter table issues
  add column if not exists agent text not null default 'COM';
