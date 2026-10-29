create table if not exists public.ai_question_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'released')),
  created_at timestamptz not null default now()
);

create index if not exists ai_reservations_user_day_idx
  on public.ai_question_reservations(user_id, day);

alter table public.ai_question_reservations enable row level security;

revoke all on public.ai_question_reservations from anon, authenticated;
grant all on public.ai_question_reservations to service_role;
create or replace function public.reserve_ai_question(
  _user_id uuid,
  _day date,
  _is_pro boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_id uuid;
  used_count integer;
  bonus_count integer;
  pending_count integer;
  daily_limit integer;
begin
  if _user_id is null then
    raise exception 'Missing user ID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(_user_id::text || ':' || _day::text, 0)
  );

  select coalesce(count, 0), coalesce(bonus, 0)
  into used_count, bonus_count
  from public.ai_usage
  where user_id = _user_id and day = _day;

  used_count := coalesce(used_count, 0);
  bonus_count := least(coalesce(bonus_count, 0), 3);

  update public.ai_question_reservations
  set status = 'released'
  where user_id = _user_id
    and day = _day
    and status = 'pending'
    and created_at < now() - interval '2 minutes';

  select count(*) into pending_count
  from public.ai_question_reservations
  where user_id = _user_id
    and day = _day
    and status = 'pending';

  daily_limit := case
    when _is_pro then 20
    else 3 + bonus_count
  end;

  if used_count + pending_count >= daily_limit then
    return null;
  end if;

  insert into public.ai_question_reservations(user_id, day)
  values (_user_id, _day)
  returning id into reservation_id;

  return reservation_id;
end;
$$;

revoke all on function public.reserve_ai_question(uuid, date, boolean)
from public, anon, authenticated;

grant execute on function public.reserve_ai_question(uuid, date, boolean)
to service_role;
create or replace function public.finish_ai_question(
  _reservation_id uuid,
  _success boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation record;
begin
  select id, user_id, day
  into reservation
  from public.ai_question_reservations
  where id = _reservation_id;

  if not found then
    raise exception 'Reservation not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(reservation.user_id::text || ':' || reservation.day::text, 0)
  );

  select id, user_id, day, status, created_at
  into reservation
  from public.ai_question_reservations
  where id = _reservation_id
  for update;

  if reservation.status <> 'pending' then
    return false;
  end if;

  if reservation.created_at < now() - interval '2 minutes' then
    update public.ai_question_reservations
    set status = 'released'
    where id = _reservation_id;

    return false;
  end if;

  if _success then
    insert into public.ai_usage(user_id, day, count)
    values (reservation.user_id, reservation.day, 1)
    on conflict (user_id, day)
    do update set count = public.ai_usage.count + 1;
  end if;

  update public.ai_question_reservations
  set status = case
    when _success then 'completed'
    else 'released'
  end
  where id = _reservation_id;

  return true;
end;
$$;

revoke all on function public.finish_ai_question(uuid, boolean)
from public, anon, authenticated;

grant execute on function public.finish_ai_question(uuid, boolean)
to service_role;




