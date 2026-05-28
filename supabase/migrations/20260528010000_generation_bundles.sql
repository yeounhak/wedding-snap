alter table public.generation_jobs
  add column if not exists result_count integer not null default 1
  check (result_count > 0);

drop function if exists public.reserve_credit_generation(uuid);

create or replace function public.reserve_credit_generation(
  p_user_id uuid,
  p_credit_cost integer default 1
)
returns table (allowed boolean, credit_ledger_id uuid, balance_after integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_credit_id uuid;
  v_credit_cost integer := greatest(1, coalesce(p_credit_cost, 1));
begin
  if p_user_id is null then
    return query select false, null::uuid, 0, 'missing_user';
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select public.get_user_credit_balance(p_user_id) into v_balance;
  if v_balance < v_credit_cost then
    return query select false, null::uuid, v_balance, 'insufficient_credits';
    return;
  end if;

  insert into public.generation_credits (user_id, delta, reason)
  values (p_user_id, -v_credit_cost, 'generation_reserve')
  returning id into v_credit_id;

  return query select true, v_credit_id, v_balance - v_credit_cost, null::text;
end;
$$;

revoke all on function public.reserve_credit_generation(uuid, integer)
  from public, anon, authenticated;

grant execute on function public.reserve_credit_generation(uuid, integer)
  to service_role;
