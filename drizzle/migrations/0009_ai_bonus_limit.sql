create or replace function public.grant_ai_bonus(_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if _day < current_date - 1 or _day > current_date + 1 then
    raise exception 'Invalid day';
  end if;

  insert into public.ai_usage(user_id, day, count, bonus)
  values (auth.uid(), _day, 0, 3)
  on conflict (user_id, day)
  do update set bonus = greatest(least(public.ai_usage.bonus, 3), 3);
end;
$$;

