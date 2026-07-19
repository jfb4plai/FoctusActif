-- supabase/migrations/20260719140000_add_task_picto_url.sql

alter table public.focus_tasks add column if not exists picto_url text;
