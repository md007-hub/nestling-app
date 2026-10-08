create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_subscriptions_user_id on public.subscriptions(user_id);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "Users can view own subscription" on public.subscriptions for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_family_pro(check_env text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.environment = check_env
      and (
        (s.status in ('active','trialing','past_due') and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'canceled' and s.current_period_end > now())
      )
      and (
        s.user_id = auth.uid()
        or s.user_id in (
          select m2.user_id from public.baby_members m1
          join public.baby_members m2 on m2.baby_id = m1.baby_id
          where m1.user_id = auth.uid()
        )
      )
  )
$$;

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;
alter table public.ai_usage enable row level security;
create policy "own usage" on public.ai_usage for select to authenticated using (user_id = auth.uid());

create or replace function public.consume_ai_question(check_env text, _day date)
returns json language plpgsql security definer set search_path = public as $$
declare used int; pro boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  pro := public.has_family_pro(check_env);
  if pro then return json_build_object('allowed', true, 'pro', true, 'used', 0); end if;
  select count into used from public.ai_usage where user_id = auth.uid() and day = _day;
  used := coalesce(used, 0);
  if used >= 3 then return json_build_object('allowed', false, 'pro', false, 'used', used); end if;
  insert into public.ai_usage(user_id, day, count) values (auth.uid(), _day, 1)
    on conflict (user_id, day) do update set count = public.ai_usage.count + 1;
  return json_build_object('allowed', true, 'pro', false, 'used', used + 1);
end $$;

alter publication supabase_realtime add table public.subscriptions;