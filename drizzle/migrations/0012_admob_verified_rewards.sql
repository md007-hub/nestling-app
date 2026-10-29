drop function if exists public.apply_verified_admob_reward(
  text, uuid, date
);
create table if not exists public.admob_verified_rewards (
  transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  verified_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.admob_verified_rewards enable row level security;

revoke all on public.admob_verified_rewards from anon, authenticated;
grant all on public.admob_verified_rewards to service_role;

create or replace function public.apply_verified_admob_reward(
  _transaction_id text,
  _user_id uuid,
  _day date,
  _token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_request record;
begin
  if _transaction_id is null
     or length(trim(_transaction_id)) = 0
     or _user_id is null
     or _day is null
     or _token is null then
    raise exception 'Invalid reward details';
  end if;

  if _day <> (now() at time zone 'UTC')::date then
    raise exception 'Reward day must be current UTC day';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(_user_id::text || ':' || _day::text, 0)
  );

  select *
  into reward_request
  from public.admob_reward_requests
  where token = _token
  for update;

  if not found then
    return false;
  end if;

  if reward_request.user_id <> _user_id
     or reward_request.consumed_at is not null
     or reward_request.expires_at <= now()
 then
    return false;
  end if;

  insert into public.admob_verified_rewards (
    transaction_id, user_id, day
  )
  values (
    _transaction_id, _user_id, _day
  )
  on conflict do nothing;

  if not found then
    return false;
  end if;

  update public.admob_reward_requests
  set consumed_at = now()
  where token = _token;

  insert into public.ai_usage (
    user_id, day, count, bonus
  )
  values (
    _user_id, _day, 0, 3
  )
  on conflict (user_id, day)
  do update set bonus = 3;

  return true;
end;
$$;

revoke all on function public.apply_verified_admob_reward(
  text, uuid, date, uuid
) from public, anon, authenticated;

grant execute on function public.apply_verified_admob_reward(
  text, uuid, date, uuid
) to service_role;

