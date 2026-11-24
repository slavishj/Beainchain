begin;

create table if not exists public.bc_turn_clock (
  game_code text primary key references public.brainchain_games(invite_code) on delete cascade,
  started_at timestamptz not null
);
create table if not exists public.bc_turn_responses (
  id bigint generated always as identity primary key,
  player_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null,
  seconds double precision not null check (seconds >= 0)
);
create index if not exists bc_turn_responses_recent
  on public.bc_turn_responses (player_id, completed_at desc, id desc);

alter table public.bc_turn_clock enable row level security;
alter table public.bc_turn_responses enable row level security;
revoke all on public.bc_turn_clock, public.bc_turn_responses from public, anon, authenticated;

create or replace function public.bc_record_turn_response()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  finished_at timestamptz := clock_timestamp();
  started_at_value timestamptz;
  finishing_player uuid;
begin
  if old.status = 'active' and (
    new.status is distinct from old.status or
    new.current_player is distinct from old.current_player or
    new.word_number is distinct from old.word_number
  ) then
    delete from public.bc_turn_clock where game_code = old.invite_code
      returning started_at into started_at_value;
    finishing_player := case old.current_player
      when 1 then old.player_one_id when 2 then old.player_two_id
    end;
    if new.status in ('active', 'completed') and started_at_value is not null and finishing_player is not null then
      insert into public.bc_turn_responses (player_id, completed_at, seconds)
      values (finishing_player, finished_at, greatest(0, extract(epoch from finished_at - started_at_value)));
    end if;
  end if;

  if new.status = 'active' and (
    old.status is distinct from new.status or
    old.current_player is distinct from new.current_player or
    old.word_number is distinct from new.word_number
  ) then
    insert into public.bc_turn_clock (game_code, started_at)
    values (new.invite_code, finished_at)
    on conflict (game_code) do update set started_at = excluded.started_at;
  end if;
  return new;
end;
$$;

revoke all on function public.bc_record_turn_response() from public, anon, authenticated;
create or replace trigger bc_record_turn_response after update on public.brainchain_games
  for each row execute function public.bc_record_turn_response();

create or replace function public.bc_typical_turn_response(p_screen_name text default null)
returns double precision language sql stable security definer set search_path = '' as $$
  select case when count(*) >= 5 then percentile_cont(0.5) within group (order by seconds) end
  from (
    select r.seconds
    from public.bc_turn_responses r
    where auth.uid() is not null and r.player_id = case when p_screen_name is null then auth.uid() else (
      select p.user_id from public.brainchain_profiles p
      where lower(p.screen_name) = lower(p_screen_name)
      limit 1
    ) end
    order by r.completed_at desc, r.id desc
    limit 20
  ) recent;
$$;

revoke all on function public.bc_typical_turn_response(text) from public, anon, authenticated;
grant execute on function public.bc_typical_turn_response(text) to authenticated;

commit;
