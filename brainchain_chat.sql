begin;

create table public.brainchain_chat_messages (
  id bigint generated always as identity primary key,
  game_code text not null references public.brainchain_games(invite_code) on delete cascade,
  sender_id uuid not null default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 500 and char_length(body) <= 500),
  sent_at timestamptz not null default now()
);

create index on public.brainchain_chat_messages (game_code, id desc);

create function public.bc_can_chat(p_code text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.brainchain_games as g
    where g.invite_code = p_code
      and g.player_two_id is not null
      and auth.uid() in (g.player_one_id, g.player_two_id)
  );
$$;

revoke all on function public.bc_can_chat(text) from public, anon, authenticated;
grant execute on function public.bc_can_chat(text) to authenticated;
alter table public.brainchain_chat_messages enable row level security;
revoke all on public.brainchain_chat_messages from public, anon, authenticated;
grant select on public.brainchain_chat_messages to authenticated;
grant insert (game_code, body) on public.brainchain_chat_messages to authenticated;

create policy chat_participants_read on public.brainchain_chat_messages
for select to authenticated
using (public.bc_can_chat(game_code));

create policy chat_participants_send on public.brainchain_chat_messages
for insert to authenticated
with check (sender_id = auth.uid() and public.bc_can_chat(game_code));

commit;
