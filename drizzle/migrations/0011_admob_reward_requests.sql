create table if not exists public.admob_reward_requests (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz
);

create index if not exists admob_reward_requests_user_idx
  on public.admob_reward_requests(user_id, created_at);

alter table public.admob_reward_requests enable row level security;

revoke all on public.admob_reward_requests from anon, authenticated;
grant all on public.admob_reward_requests to service_role;

create or replace function public.create_admob_reward_request(
  _user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token uuid;
begin
  if _user_id is null then
    raise exception 'Missing user ID';
  end if;

  insert into public.admob_reward_requests(user_id)
  values (_user_id)
  returning token into new_token;

  return new_token;
end;
$$;

revoke all on function public.create_admob_reward_request(uuid)
from public, anon, authenticated;

grant execute on function public.create_admob_reward_request(uuid)
to service_role;
