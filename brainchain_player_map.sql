begin;

create table if not exists public.bc_profile_states (
  user_id uuid primary key references public.brainchain_profiles(user_id) on delete cascade,
  state_code text not null check (state_code in ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'))
);
alter table public.bc_profile_states enable row level security;
revoke all on public.bc_profile_states from public, anon, authenticated;

create or replace function public.bc_profile_get_with_state()
returns jsonb language sql security definer set search_path = ''
as $$
  select public.bc_profile_get() || jsonb_build_object('state', (
    select state_code from public.bc_profile_states where user_id = auth.uid()
  ));
$$;

create or replace function public.bc_profile_save_with_state(
  p_name text, p_avatar text, p_photo text, p_state text
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  perform public.bc_profile_save(p_name, p_avatar, p_photo);
  if p_state is null then
    delete from public.bc_profile_states where user_id = auth.uid();
  else
    insert into public.bc_profile_states(user_id, state_code) values (auth.uid(), p_state)
    on conflict (user_id) do update set state_code = excluded.state_code;
  end if;
end;
$$;

create or replace function public.bc_admin_player_map()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.bc_mail_admins where user_id = auth.uid()) then
    raise insufficient_privilege using message = 'Admin access required';
  end if;
  return (
    select jsonb_build_object(
      'states', coalesce(jsonb_object_agg(state_code, players) filter (where state_code is not null), '{}'::jsonb),
      'unselected', coalesce(max(players) filter (where state_code is null), 0)
    )
    from (
      select s.state_code, count(*) as players
      from public.brainchain_profiles p left join public.bc_profile_states s using (user_id)
      group by s.state_code
    ) counts
  );
end;
$$;

revoke all on function public.bc_profile_get_with_state(), public.bc_profile_save_with_state(text,text,text,text), public.bc_admin_player_map() from public, anon, authenticated;
grant execute on function public.bc_profile_get_with_state(), public.bc_profile_save_with_state(text,text,text,text), public.bc_admin_player_map() to authenticated;

commit;

begin;

alter table public.bc_profile_states drop constraint bc_profile_states_user_id_fkey;
alter table public.bc_profile_states add constraint bc_profile_states_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create or replace function public.bc_profile_set_state(p_state text)
returns void language plpgsql security definer set search_path = ''
as $
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_state is null then
    delete from public.bc_profile_states where user_id = auth.uid();
  else
    insert into public.bc_profile_states(user_id, state_code) values (auth.uid(), p_state)
    on conflict (user_id) do update set state_code = excluded.state_code;
  end if;
end;
$;

create or replace function public.bc_profile_save_with_state(p_name text, p_avatar text, p_photo text, p_state text)
returns void language plpgsql security definer set search_path = ''
as $
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  perform public.bc_profile_save(p_name, p_avatar, p_photo);
  perform public.bc_profile_set_state(p_state);
end;
$;

create or replace function public.bc_admin_player_map()
returns jsonb language plpgsql security definer set search_path = ''
as $
begin
  if not exists (select 1 from public.bc_mail_admins where user_id = auth.uid()) then
    raise insufficient_privilege using message = 'Admin access required';
  end if;
  return (
    select jsonb_build_object(
      'states', coalesce(jsonb_object_agg(state_code, players) filter (where state_code is not null), '{}'::jsonb),
      'unselected', coalesce(max(players) filter (where state_code is null), 0)
    )
    from (
      select s.state_code, count(*) as players
      from public.brainchain_profiles p full join public.bc_profile_states s using (user_id)
      group by s.state_code
    ) counts
  );
end;
$;

revoke all on function public.bc_profile_set_state(text) from public, anon, authenticated;
grant execute on function public.bc_profile_set_state(text) to authenticated;

commit;
