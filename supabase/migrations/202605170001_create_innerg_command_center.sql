create table if not exists public.innerg_command_items (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('energy', 'eco', 'ownyourweb', 'shopnasgfx')),
  title text not null,
  body text not null,
  raw_message text not null,
  item_type text not null default 'update',
  status text not null default 'active' check (status in ('active', 'waiting', 'done', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  source text not null default 'dashboard',
  tags text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.innerg_command_items enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on public.innerg_command_items from anon, authenticated;

create index if not exists innerg_command_items_board_status_idx
  on public.innerg_command_items (board, status, created_at desc);

create index if not exists innerg_command_items_due_idx
  on public.innerg_command_items (due_at)
  where due_at is not null and status <> 'done';
