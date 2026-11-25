begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create table if not exists public.bc_push_config (
 id boolean primary key default true check(id),
 dispatcher uuid not null default gen_random_uuid(),
 public_key text, private_key text
);
insert into public.bc_push_config(id) values(true) on conflict do nothing;
create table if not exists public.bc_push_devices (
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users on delete cascade,
 endpoint text unique not null, subscription jsonb not null, baseline jsonb not null,
 due timestamptz not null default now(), lease uuid
);
create table if not exists public.bc_push_chat_state (
 owner uuid not null references auth.users on delete cascade,
 code text not null references public.brainchain_games(invite_code) on delete cascade,
 seen bigint not null default 0, muted boolean not null default false, primary key(owner,code)
);
alter table public.bc_push_config enable row level security;
alter table public.bc_push_devices enable row level security;
alter table public.bc_push_chat_state enable row level security;
revoke all on public.bc_push_config,public.bc_push_devices,public.bc_push_chat_state from public,anon,authenticated;
grant select,update on public.bc_push_config,public.bc_push_devices to service_role;
grant delete on public.bc_push_devices to service_role;

create or replace function public.bc_push_items(u uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(key,jsonb_build_array(version,n)), '{}'::jsonb) from (
 select 'turn:'||g.invite_code key, coalesce(c.started_at::text,g.word_number::text) version, 1::bigint n
 from public.brainchain_games g left join public.bc_turn_clock c on c.game_code=g.invite_code
 where g.status='active' and (g.current_player=1 and g.player_one_id=u or g.current_player=2 and g.player_two_id=u)
 union all
 select 'chat:'||m.game_code,max(m.id)::text,count(*) from public.brainchain_chat_messages m
 join public.brainchain_games g on g.invite_code=m.game_code
 left join public.bc_push_chat_state r on r.owner=u and r.code=m.game_code
 where u in (g.player_one_id,g.player_two_id) and m.sender_id<>u and m.id>coalesce(r.seen,0) and not coalesce(r.muted,false)
 group by m.game_code
 union all
 select (case when m.from_admin then 'mail:' else 'admin:' end)||m.thread_id,max(m.id)::text,count(*)
 from public.bc_mail_messages m join public.bc_mail_threads t on t.id=m.thread_id
 left join public.bc_mail_reads r on r.thread_id=t.id and r.user_id=u and r.as_admin=(not m.from_admin)
 where m.id>coalesce(r.last_read,0) and (
 m.from_admin and (t.player_id=u or t.player_id is null) or
 not m.from_admin and exists(select 1 from public.bc_mail_admins a where a.user_id=u))
 group by m.from_admin,m.thread_id
 ) items
$$;
create or replace function public.bc_push_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('count',(select coalesce(sum((value->>1)::bigint),0) from jsonb_each(public.bc_push_items(auth.uid()))),
 'key',(select public_key from public.bc_push_config where id))
$$;
create or replace function public.bc_push_register(sub jsonb, enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); ep text:=sub->>'endpoint';
begin
 if u is null then raise exception 'Sign in first'; end if;
 if not enabled then delete from public.bc_push_devices where endpoint=ep and owner=u; return; end if;
 if ep is null or length(ep)>2048 or ep !~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)/[A-Za-z0-9_:/?=.%&~-]+$'
 or coalesce(sub#>>'{keys,p256dh}','') !~ '^[A-Za-z0-9_-]{87}$'
 or coalesce(sub#>>'{keys,auth}','') !~ '^[A-Za-z0-9_-]{22}$' then raise exception 'Unsupported push subscription'; end if;
 insert into public.bc_push_devices(owner,endpoint,subscription,baseline)
 values(u,ep,jsonb_build_object('endpoint',ep,'keys',sub->'keys'),public.bc_push_items(u))
 on conflict(endpoint) do update set subscription=excluded.subscription where bc_push_devices.owner=u;
 if not found then raise exception 'Disable alerts for the previous profile first'; end if;
end $$;
create or replace function public.bc_push_chat(p_code text,p_seen bigint default null,p_mute boolean default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.bc_can_chat(p_code) then raise exception 'Match unavailable'; end if;
 insert into public.bc_push_chat_state(owner,code,seen,muted) values(auth.uid(),p_code,coalesce(p_seen,0),coalesce(p_mute,false))
 on conflict(owner,code) do update set seen=greatest(bc_push_chat_state.seen,excluded.seen),muted=coalesce(p_mute,bc_push_chat_state.muted);
end $$;
create or replace function public.bc_push_claim() returns table(device uuid, claim uuid, sub jsonb, previous jsonb, items jsonb)
language sql security definer set search_path='' as $$
 with batch as (select d.id, s.items from public.bc_push_devices d
 cross join lateral (select public.bc_push_items(d.owner) items) s
 where d.due<=now() and d.baseline<>s.items order by d.due limit 40 for update of d skip locked)
 update public.bc_push_devices d set due=now()+interval '2 minutes',lease=gen_random_uuid()
 from batch where batch.id=d.id returning d.id,d.lease,d.subscription,d.baseline,batch.items
$$;
revoke all on function public.bc_push_items(uuid),public.bc_push_claim(),public.bc_push_status(),public.bc_push_register(jsonb,boolean),public.bc_push_chat(text,bigint,boolean) from public,anon,authenticated;
grant execute on function public.bc_push_claim() to service_role;
grant execute on function public.bc_push_status(), public.bc_push_register(jsonb,boolean), public.bc_push_chat(text,bigint,boolean) to authenticated;
select cron.schedule('brainchain-push','* * * * *',$job$
 select net.http_post(url:='https://hsdvkdvimzyyyjdhbtzb.supabase.co/functions/v1/brainchain-push',
 headers:=jsonb_build_object('Content-Type','application/json','x-bc-dispatch',dispatcher::text),body:='{}'::jsonb,timeout_milliseconds:=35000)
 from public.bc_push_config where public_key is null or exists(select 1 from public.bc_push_devices)
$job$);
commit;
