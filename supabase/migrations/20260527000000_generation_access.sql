create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.generation_quota_windows (
  id uuid primary key default extensions.gen_random_uuid(),
  subject_type text not null check (subject_type in ('anonymous_device')),
  subject_key text not null,
  used_count integer not null default 0 check (used_count >= 0),
  window_started_at timestamptz not null default now(),
  window_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_type, subject_key)
);

create table if not exists public.generation_credits (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (
    reason in ('purchase', 'generation_reserve', 'generation_refund', 'manual')
  ),
  related_job_id uuid,
  order_id text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  order_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_sku text not null,
  order_name text not null,
  amount integer not null check (amount > 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  credit_amount integer not null check (credit_amount > 0),
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'failed', 'canceled')
  ),
  payment_key text unique,
  failure_code text,
  failure_message text,
  toss_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed')
  ),
  access_mode text not null check (
    access_mode in ('anonymous_watermarked', 'credit_clean')
  ),
  requires_watermark boolean not null default true,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_device_hash text,
  ip_prefix_hash text,
  quota_window_id uuid references public.generation_quota_windows(id),
  credit_ledger_id uuid references public.generation_credits(id),
  input_male_object_path text not null,
  input_male_mime_type text not null,
  input_female_object_path text not null,
  input_female_mime_type text not null,
  clean_object_path text,
  watermarked_object_path text,
  result_mime_type text,
  model text,
  size text,
  quality text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (access_mode = 'anonymous_watermarked' and anonymous_device_hash is not null)
    or (access_mode = 'credit_clean' and user_id is not null and credit_ledger_id is not null)
  )
);

alter table public.generation_credits
  add constraint generation_credits_related_job_id_fkey
  foreign key (related_job_id) references public.generation_jobs(id)
  on delete set null;

create table if not exists public.job_unlocks (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  anonymous_device_hash text not null,
  created_at timestamptz not null default now(),
  unique (job_id),
  unique (user_id)
);

create unique index if not exists generation_credits_purchase_order_unique
  on public.generation_credits(order_id)
  where order_id is not null and reason = 'purchase';

create unique index if not exists generation_credits_refund_job_unique
  on public.generation_credits(related_job_id)
  where related_job_id is not null and reason = 'generation_refund';

create index if not exists generation_jobs_user_id_created_at_idx
  on public.generation_jobs(user_id, created_at desc);

create index if not exists generation_jobs_device_created_at_idx
  on public.generation_jobs(anonymous_device_hash, created_at desc);

create index if not exists generation_jobs_ip_created_at_idx
  on public.generation_jobs(ip_prefix_hash, created_at desc)
  where ip_prefix_hash is not null;

create trigger generation_quota_windows_set_updated_at
  before update on public.generation_quota_windows
  for each row execute function public.set_updated_at();

create trigger payment_orders_set_updated_at
  before update on public.payment_orders
  for each row execute function public.set_updated_at();

create trigger generation_jobs_set_updated_at
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();

alter table public.generation_quota_windows enable row level security;
alter table public.generation_credits enable row level security;
alter table public.payment_orders enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.job_unlocks enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-snap-jobs',
  'wedding-snap-jobs',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.reserve_anonymous_generation(
  p_device_hash text,
  p_ip_prefix_hash text default null,
  p_window_months integer default 3
)
returns table (allowed boolean, quota_window_id uuid, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window public.generation_quota_windows%rowtype;
  v_now timestamptz := now();
  v_window_interval interval := make_interval(months => greatest(1, p_window_months));
begin
  if p_device_hash is null or length(trim(p_device_hash)) = 0 then
    return query select false, null::uuid, 'missing_device_hash';
    return;
  end if;

  insert into public.generation_quota_windows (
    subject_type,
    subject_key,
    used_count,
    window_started_at,
    window_ends_at
  )
  values (
    'anonymous_device',
    p_device_hash,
    0,
    v_now,
    v_now + v_window_interval
  )
  on conflict (subject_type, subject_key) do nothing;

  select *
  into v_window
  from public.generation_quota_windows
  where subject_type = 'anonymous_device'
    and subject_key = p_device_hash
  for update;

  if v_window.window_ends_at <= v_now then
    update public.generation_quota_windows
    set
      used_count = 1,
      window_started_at = v_now,
      window_ends_at = v_now + v_window_interval
    where id = v_window.id
    returning * into v_window;

    return query select true, v_window.id, null::text;
    return;
  end if;

  if v_window.used_count < 1 then
    update public.generation_quota_windows
    set used_count = used_count + 1
    where id = v_window.id
    returning * into v_window;

    return query select true, v_window.id, null::text;
    return;
  end if;

  return query select false, v_window.id, 'anonymous_quota_exhausted';
end;
$$;

create or replace function public.get_user_credit_balance(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(delta), 0)::integer
  from public.generation_credits
  where user_id = p_user_id;
$$;

create or replace function public.reserve_credit_generation(p_user_id uuid)
returns table (allowed boolean, credit_ledger_id uuid, balance_after integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_credit_id uuid;
begin
  if p_user_id is null then
    return query select false, null::uuid, 0, 'missing_user';
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select public.get_user_credit_balance(p_user_id) into v_balance;
  if v_balance < 1 then
    return query select false, null::uuid, v_balance, 'insufficient_credits';
    return;
  end if;

  insert into public.generation_credits (user_id, delta, reason)
  values (p_user_id, -1, 'generation_reserve')
  returning id into v_credit_id;

  return query select true, v_credit_id, v_balance - 1, null::text;
end;
$$;

create or replace function public.confirm_payment_order(
  p_order_id text,
  p_payment_key text,
  p_toss_payload jsonb
)
returns table (credits_granted integer, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
begin
  select *
  into v_order
  from public.payment_orders
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'payment order not found: %', p_order_id;
  end if;

  if v_order.status = 'paid' then
    return query select v_order.credit_amount, v_order.status;
    return;
  end if;

  if v_order.status <> 'pending' then
    raise exception 'payment order is not pending: %', p_order_id;
  end if;

  update public.payment_orders
  set
    status = 'paid',
    payment_key = p_payment_key,
    toss_payload = p_toss_payload,
    failure_code = null,
    failure_message = null
  where order_id = p_order_id
  returning * into v_order;

  insert into public.generation_credits (
    user_id,
    delta,
    reason,
    order_id,
    note
  )
  values (
    v_order.user_id,
    v_order.credit_amount,
    'purchase',
    v_order.order_id,
    v_order.product_sku
  )
  on conflict do nothing;

  return query select v_order.credit_amount, v_order.status;
end;
$$;

create or replace function public.unlock_anonymous_job(
  p_job_id uuid,
  p_user_id uuid,
  p_device_hash text
)
returns table (allowed boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs%rowtype;
  v_existing public.job_unlocks%rowtype;
begin
  select *
  into v_job
  from public.generation_jobs
  where id = p_job_id
  for update;

  if not found then
    return query select false, 'job_not_found';
    return;
  end if;

  if v_job.status <> 'succeeded' or v_job.clean_object_path is null then
    return query select false, 'job_not_ready';
    return;
  end if;

  if v_job.access_mode <> 'anonymous_watermarked'
    or v_job.anonymous_device_hash is null
    or v_job.anonymous_device_hash <> p_device_hash then
    return query select false, 'device_mismatch';
    return;
  end if;

  select *
  into v_existing
  from public.job_unlocks
  where user_id = p_user_id
  for update;

  if found then
    if v_existing.job_id = p_job_id then
      return query select true, null::text;
      return;
    end if;

    return query select false, 'login_unlock_used';
    return;
  end if;

  insert into public.job_unlocks (job_id, user_id, anonymous_device_hash)
  values (p_job_id, p_user_id, p_device_hash);

  return query select true, null::text;
end;
$$;

revoke all on function public.reserve_anonymous_generation(text, text, integer)
  from public, anon, authenticated;
revoke all on function public.get_user_credit_balance(uuid)
  from public, anon, authenticated;
revoke all on function public.reserve_credit_generation(uuid)
  from public, anon, authenticated;
revoke all on function public.confirm_payment_order(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.unlock_anonymous_job(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.reserve_anonymous_generation(text, text, integer)
  to service_role;
grant execute on function public.get_user_credit_balance(uuid)
  to service_role;
grant execute on function public.reserve_credit_generation(uuid)
  to service_role;
grant execute on function public.confirm_payment_order(text, text, jsonb)
  to service_role;
grant execute on function public.unlock_anonymous_job(uuid, uuid, text)
  to service_role;
