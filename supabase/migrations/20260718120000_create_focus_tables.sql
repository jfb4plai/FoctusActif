-- supabase/migrations/20260718120000_create_focus_tables.sql

create table if not exists public.focus_contexts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  emoji text not null default '📌',
  locked boolean not null default false,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.focus_tasks (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.focus_contexts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'done')),
  parent_task_id uuid references public.focus_tasks(id) on delete cascade,
  step_order integer not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index if not exists focus_tasks_context_id_idx on public.focus_tasks(context_id);
create index if not exists focus_tasks_parent_task_id_idx on public.focus_tasks(parent_task_id);

create table if not exists public.focus_links (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade,
  student_id uuid references auth.users(id) on delete cascade,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  initiated_by text not null check (initiated_by in ('teacher', 'student')),
  status text not null default 'pending' check (status in ('pending', 'linked')),
  created_at timestamptz not null default now(),
  linked_at timestamptz
);

alter table public.focus_contexts enable row level security;
alter table public.focus_tasks enable row level security;
alter table public.focus_links enable row level security;

-- focus_contexts : le propriétaire a tous les droits
create policy "focus_contexts_owner_all" on public.focus_contexts
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- focus_contexts : un enseignant lié peut voir les contextes de l'élève
create policy "focus_contexts_teacher_select" on public.focus_contexts
  for select
  using (
    exists (
      select 1 from public.focus_links l
      where l.status = 'linked' and l.teacher_id = auth.uid() and l.student_id = focus_contexts.owner_id
    )
  );

-- focus_contexts : un enseignant ne peut modifier/créer que les contextes qu'il verrouille lui-même
create policy "focus_contexts_teacher_manage_locked" on public.focus_contexts
  for update
  using (locked_by = auth.uid())
  with check (locked_by = auth.uid());

create policy "focus_contexts_teacher_insert_locked" on public.focus_contexts
  for insert
  with check (
    locked_by = auth.uid()
    and exists (
      select 1 from public.focus_links l
      where l.status = 'linked' and l.teacher_id = auth.uid() and l.student_id = focus_contexts.owner_id
    )
  );

-- focus_tasks : accessible à qui a accès au contexte parent (propriétaire ou enseignant verrouillant)
create policy "focus_tasks_via_context" on public.focus_tasks
  for all
  using (
    exists (
      select 1 from public.focus_contexts c
      where c.id = focus_tasks.context_id
        and (c.owner_id = auth.uid() or c.locked_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.focus_contexts c
      where c.id = focus_tasks.context_id
        and (c.owner_id = auth.uid() or c.locked_by = auth.uid())
    )
  );

-- focus_links : chaque partie voit ses propres liens
create policy "focus_links_visible_to_parties" on public.focus_links
  for select
  using (auth.uid() = teacher_id or auth.uid() = student_id);

-- focus_links : chacun ne peut créer qu'un lien "en attente" à son propre nom
create policy "focus_links_insert_own" on public.focus_links
  for insert
  with check (
    (initiated_by = 'teacher' and teacher_id = auth.uid() and student_id is null)
    or (initiated_by = 'student' and student_id = auth.uid() and teacher_id is null)
  );

-- focus_links : chaque partie peut révoquer un lien qui la concerne
create policy "focus_links_owner_delete" on public.focus_links
  for delete
  using (auth.uid() = teacher_id or auth.uid() = student_id);

-- Réclamation d'un lien par code : passe par une fonction SECURITY DEFINER,
-- pas par une politique RLS permissive (qui exposerait les codes/lignes en attente
-- de tout le monde à qui que ce soit sachant faire un SELECT).
create or replace function public.focus_claim_link(p_code text)
returns public.focus_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.focus_links;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_link from public.focus_links
    where invite_code = p_code and status = 'pending'
    for update;

  if not found then
    raise exception 'invalid_or_used_code';
  end if;

  if v_link.initiated_by = 'teacher' then
    if v_link.teacher_id = v_uid then
      raise exception 'invalid_or_used_code';
    end if;
    update public.focus_links
      set student_id = v_uid, status = 'linked', linked_at = now()
      where id = v_link.id
      returning * into v_link;
  else
    if v_link.student_id = v_uid then
      raise exception 'invalid_or_used_code';
    end if;
    update public.focus_links
      set teacher_id = v_uid, status = 'linked', linked_at = now()
      where id = v_link.id
      returning * into v_link;
  end if;

  return v_link;
end;
$$;

grant execute on function public.focus_claim_link(text) to authenticated;
