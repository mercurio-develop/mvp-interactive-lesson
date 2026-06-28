-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
-- Creates / updates the results table and policies for the anon (public) key.

create table if not exists public.forest_lab_results (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  successes integer not null default 0,
  total_experiments integer not null default 3,
  all_passed boolean not null default false,
  experiment_status jsonb,
  -- legacy columns (kept for older deployments)
  lab_rank text,
  score integer default 0,
  attempts integer default 3,
  time_seconds integer default 0,
  created_at timestamptz not null default now()
);

alter table public.forest_lab_results add column if not exists successes integer default 0;
alter table public.forest_lab_results add column if not exists total_experiments integer default 3;
alter table public.forest_lab_results add column if not exists all_passed boolean default false;
alter table public.forest_lab_results add column if not exists experiment_status jsonb;

alter table public.forest_lab_results enable row level security;

drop policy if exists "forest_lab_anon_insert" on public.forest_lab_results;
drop policy if exists "forest_lab_anon_select" on public.forest_lab_results;
drop policy if exists "forest_lab_anon_delete" on public.forest_lab_results;

create policy "forest_lab_anon_insert"
  on public.forest_lab_results for insert to anon
  with check (true);

create policy "forest_lab_anon_select"
  on public.forest_lab_results for select to anon
  using (true);

create policy "forest_lab_anon_delete"
  on public.forest_lab_results for delete to anon
  using (true);
