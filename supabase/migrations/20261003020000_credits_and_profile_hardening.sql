-- Credits integrity + profile hardening
--
-- 1. adjust_credits(): one atomic, logged, idempotent way to change a user's credits.
--    Replaces read-modify-write updates scattered across API routes (lost updates
--    under concurrency, double grants on webhook retries).
-- 2. sms_scheduled_messages.credits_reserved: how many credits a campaign actually
--    holds in reserved_credits, so release/settlement uses the real amount instead of
--    a client-supplied preview count or message_limit.
-- 3. protect_profile_privileged_columns: users (anon/authenticated JWT) can no longer
--    change billing, credit, trial or admin fields on their own profile row, whatever
--    the RLS UPDATE policy allows. Service role / server-side code is unaffected.

-- ---------------------------------------------------------------------------
-- 1. Credits
-- ---------------------------------------------------------------------------
alter table public.credit_transactions
  add column if not exists idempotency_key text;

create unique index if not exists credit_transactions_idempotency_key_key
  on public.credit_transactions (idempotency_key)
  where idempotency_key is not null;

alter table public.sms_scheduled_messages
  add column if not exists credits_reserved integer not null default 0;

create or replace function public.adjust_credits(
  p_user_id uuid,
  p_available_delta double precision,
  p_reserved_delta double precision,
  p_action text,
  p_reference_id text default null,
  p_idempotency_key text default null,
  p_allow_negative boolean default false
)
returns table (
  applied boolean,
  old_available double precision,
  new_available double precision,
  old_reserved double precision,
  new_reserved double precision
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_available double precision;
  v_old_reserved double precision;
  v_new_available double precision;
  v_new_reserved double precision;
begin
  select coalesce(p.available_credits, 0), coalesce(p.reserved_credits, 0)
    into v_old_available, v_old_reserved
    from public.profiles p
   where p.user_id = p_user_id
     for update;

  if not found then
    raise exception 'profile not found for user %', p_user_id using errcode = 'P0002';
  end if;

  -- Already processed (webhook retry, replayed callback, double click)
  if p_idempotency_key is not null and exists (
    select 1 from public.credit_transactions ct where ct.idempotency_key = p_idempotency_key
  ) then
    return query select false, v_old_available, v_old_available, v_old_reserved, v_old_reserved;
    return;
  end if;

  v_new_available := v_old_available + coalesce(p_available_delta, 0);
  v_new_reserved := greatest(0, v_old_reserved + coalesce(p_reserved_delta, 0));

  if v_new_available < 0 and not p_allow_negative then
    raise exception 'insufficient credits' using errcode = 'P0001';
  end if;

  update public.profiles
     set available_credits = v_new_available,
         reserved_credits = v_new_reserved,
         updated_at = now()
   where user_id = p_user_id;

  insert into public.credit_transactions (
    user_id, action, old_available, new_available, old_reserved, new_reserved,
    reference_id, idempotency_key, created_at
  ) values (
    p_user_id, p_action, round(v_old_available)::int, round(v_new_available)::int,
    round(v_old_reserved)::int, round(v_new_reserved)::int,
    p_reference_id, p_idempotency_key, now()
  );

  return query select true, v_old_available, v_new_available, v_old_reserved, v_new_reserved;
end;
$$;

revoke all on function public.adjust_credits(uuid, double precision, double precision, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.adjust_credits(uuid, double precision, double precision, text, text, text, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. Profile privileged columns
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only end-user requests are restricted. Service role, SQL editor, cron and
  -- auth triggers (no JWT) pass through.
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if lower(coalesce(new.role, '')) = 'admin'
       or coalesce(new.available_credits, 0) <> 0
       or coalesce(new.reserved_credits, 0) <> 0
       or new.stripe_id is not null
       or new.stripe_subscription_status is not null
       or new.subscription_id is not null
       or new.apple_original_transaction_id is not null
       or coalesce(new.special_access, false)
       or coalesce(new.trial_active, false)
       or new.trial_start is not null
       or new.trial_end is not null then
      raise exception 'not allowed to set protected profile fields' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Users may switch between non-admin roles (Barber <-> Owner) but never to/from Admin
  if new.role is distinct from old.role
     and (lower(coalesce(new.role, '')) = 'admin' or lower(coalesce(old.role, '')) = 'admin') then
    raise exception 'not allowed to change admin role' using errcode = '42501';
  end if;

  if new.available_credits is distinct from old.available_credits
     or new.reserved_credits is distinct from old.reserved_credits
     or new.stripe_id is distinct from old.stripe_id
     or new.stripe_subscription_status is distinct from old.stripe_subscription_status
     or new.subscription_id is distinct from old.subscription_id
     or new.subscription_source is distinct from old.subscription_source
     or new.cancel_at_period_end is distinct from old.cancel_at_period_end
     or new.apple_original_transaction_id is distinct from old.apple_original_transaction_id
     or new.special_access is distinct from old.special_access
     or new.trial_active is distinct from old.trial_active
     or new.trial_start is distinct from old.trial_start
     or new.trial_end is distinct from old.trial_end then
    raise exception 'not allowed to modify protected profile fields' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();
