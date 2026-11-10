-- The AI reply pasted for each batch of a staged paper, with which prompt and model produced it,
-- so every explanation can be traced back and redone if a prompt version is later found faulty.
-- Admin only.

create table public.import_batch_replies (
  paper_id uuid not null references public.import_papers (id) on delete cascade,
  batch_no int not null check (batch_no >= 1),
  reply text not null,
  -- The AI chat and model the admin used, typed when the reply is pasted.
  model text,
  prompt_version text not null,
  -- What the last check found, for example {"questions": 10, "publishable": 7, "warnings": []}.
  summary jsonb not null default '{}',
  saved_at timestamptz not null default now(),
  primary key (paper_id, batch_no)
);

alter table public.import_batch_replies enable row level security;
revoke all on public.import_batch_replies from anon, authenticated;
grant select, insert, update, delete on public.import_batch_replies to authenticated;
create policy import_batch_replies_admin on public.import_batch_replies for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
