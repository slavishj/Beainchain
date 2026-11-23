begin;

create table public.bc_mail_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.bc_mail_threads (
  id bigint generated always as identity primary key,
  player_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('Bug report', 'Design suggestion', 'Get help', 'Official notice')),
  subject text not null check (char_length(btrim(subject)) between 1 and 100),
  check (player_id is not null or kind = 'Official notice')
);
create index on public.bc_mail_threads (player_id, id);
create table public.bc_mail_messages (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.bc_mail_threads(id) on delete cascade,
  from_admin boolean not null,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  sent_at timestamptz not null default now()
);
create index on public.bc_mail_messages (thread_id, id);
create table public.bc_mail_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id bigint not null references public.bc_mail_threads(id) on delete cascade,
  last_read bigint not null,
  as_admin boolean not null,
  primary key (user_id, thread_id, as_admin)
);

alter table public.bc_mail_admins enable row level security;
alter table public.bc_mail_threads enable row level security;
alter table public.bc_mail_messages enable row level security;
alter table public.bc_mail_reads enable row level security;
revoke all on public.bc_mail_admins, public.bc_mail_threads, public.bc_mail_messages,
  public.bc_mail_reads from public, anon, authenticated;

create function public.bc_mailbox(p_action text, p_admin boolean default false,
  p_thread bigint default null, p_kind text default null, p_subject text default null,
  p_body text default null, p_recipient uuid default null, p_seen bigint default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  is_admin boolean;
  selected public.bc_mail_threads%rowtype;
  messages jsonb;
  threads jsonb;
  unread_player integer;
  unread_admin integer := 0;
begin
  if viewer is null then raise exception 'Sign in to use Messages'; end if;
  p_admin := coalesce(p_admin, false);
  select exists(select 1 from public.bc_mail_admins where user_id = viewer) into is_admin;
  if p_admin and not is_admin then raise exception 'Admin mailbox access required'; end if;

  if p_action = 'status' then
    select count(distinct t.id) into unread_player
    from public.bc_mail_threads t join public.bc_mail_messages m on m.thread_id = t.id
    left join public.bc_mail_reads r on r.thread_id = t.id and r.user_id = viewer and r.as_admin = p_admin
    where (t.player_id = viewer or t.player_id is null) and m.from_admin
      and m.id > coalesce(r.last_read, 0);
    if is_admin then
      select count(distinct m.thread_id) into unread_admin from public.bc_mail_messages m
      left join public.bc_mail_reads r on r.thread_id = m.thread_id and r.user_id = viewer and r.as_admin
      where not m.from_admin and m.id > coalesce(r.last_read, 0);
    end if;
    return jsonb_build_object('enabled', exists(select 1 from public.bc_mail_admins),
      'admin', is_admin, 'playerUnread', unread_player, 'adminUnread', unread_admin);
  end if;

  if p_action = 'list' then
    select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'subject', t.subject,
      'broadcast', t.player_id is null, 'date', latest.sent_at, 'unread', exists (
        select 1 from public.bc_mail_messages m where m.thread_id = t.id
          and m.from_admin <> p_admin and m.id > coalesce(r.last_read, 0)
      )) order by latest.id desc), '[]'::jsonb) into threads
    from public.bc_mail_threads t
    cross join lateral (select m.id, m.sent_at from public.bc_mail_messages m
      where m.thread_id = t.id order by m.id desc limit 1) latest
    left join public.bc_mail_reads r on r.thread_id = t.id and r.user_id = viewer and r.as_admin = p_admin
    where p_admin or t.player_id = viewer or t.player_id is null;
    return threads;
  end if;

  if p_action = 'new' then
    if p_admin then
      p_kind := 'Official notice';
    elsif p_kind is null or p_kind not in ('Bug report', 'Design suggestion', 'Get help') then
      raise exception 'Choose a message category';
    end if;
    insert into public.bc_mail_threads (player_id, kind, subject)
    values (case when p_admin then p_recipient else viewer end, p_kind, btrim(p_subject))
    returning id into p_thread;
  else
    select * into selected from public.bc_mail_threads t
    where t.id = p_thread and (p_admin or t.player_id = viewer or t.player_id is null)
    for update;
    if not found then raise exception 'Message thread unavailable'; end if;
  end if;

  if p_action in ('new', 'reply') then
    if p_action = 'reply' and selected.player_id is null then raise exception 'Broadcast notices do not accept replies'; end if;
    insert into public.bc_mail_messages (thread_id, from_admin, body) values (p_thread, p_admin, btrim(p_body));
    return to_jsonb(p_thread);
  elsif p_action = 'open' then
    select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body,
      'admin', m.from_admin, 'date', m.sent_at) order by m.id), '[]'::jsonb) into messages
    from public.bc_mail_messages m where m.thread_id = p_thread;
    return messages;
  elsif p_action = 'read' then
    insert into public.bc_mail_reads (user_id, thread_id, last_read, as_admin)
    select viewer, p_thread, m.id, p_admin from public.bc_mail_messages m
    where m.thread_id = p_thread and m.id = p_seen
    on conflict (user_id, thread_id, as_admin) do update
      set last_read = greatest(public.bc_mail_reads.last_read, excluded.last_read);
    return 'null'::jsonb;
  end if;
  raise exception 'Unknown mailbox action';
end;
$$;
revoke all on function public.bc_mailbox(text, boolean, bigint, text, text, text, uuid, bigint) from public, anon;
grant execute on function public.bc_mailbox(text, boolean, bigint, text, text, text, uuid, bigint) to authenticated;

commit;
