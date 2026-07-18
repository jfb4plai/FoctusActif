-- supabase/migrations/20260719090000_create_focus_reminders.sql

create table if not exists public.focus_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.focus_tasks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  remind_at timestamptz not null,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists focus_reminders_due_idx on public.focus_reminders(remind_at) where sent = false;

create table if not exists public.focus_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.focus_reminders enable row level security;
alter table public.focus_push_subscriptions enable row level security;

create policy "focus_reminders_owner_all" on public.focus_reminders
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "focus_push_subscriptions_owner_all" on public.focus_push_subscriptions
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
