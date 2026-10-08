alter table public.ai_usage add column if not exists bonus int not null default 0;

create or replace function public.consume_ai_question(check_env text, _day date)
returns json language plpgsql security definer set search_path = public as $$
declare used int; extra int; pro boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  pro := public.has_family_pro(check_env);
  if pro then return json_build_object('allowed', true, 'pro', true, 'used', 0, 'remaining', null); end if;
  select count, bonus into used, extra from public.ai_usage where user_id = auth.uid() and day = _day;
  used := coalesce(used, 0); extra := coalesce(extra, 0);
  if used >= 3 + extra then return json_build_object('allowed', false, 'pro', false, 'used', used, 'remaining', 0); end if;
  insert into public.ai_usage(user_id, day, count) values (auth.uid(), _day, 1)
    on conflict (user_id, day) do update set count = public.ai_usage.count + 1;
  return json_build_object('allowed', true, 'pro', false, 'used', used + 1, 'remaining', 3 + extra - used - 1);
end $$;

create or replace function public.grant_ai_bonus(_day date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if _day < current_date - 1 or _day > current_date + 1 then raise exception 'Invalid day'; end if;
  insert into public.ai_usage(user_id, day, count, bonus) values (auth.uid(), _day, 0, 3)
    on conflict (user_id, day) do update set bonus = least(public.ai_usage.bonus + 3, 30);
end $$;