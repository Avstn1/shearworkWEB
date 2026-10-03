-- Review-only helper (NOT a migration). Run by hand in the SQL editor.
--
-- Card-less trials never had trial_active cleared when they ended. The app no longer
-- trusts the flag alone (utils/trial.ts checks trial_end), so this is cosmetic cleanup
-- for reporting/admin views.

-- 1. Inspect
select user_id, full_name, trial_start, trial_end, stripe_subscription_status
from public.profiles
where trial_active = true
  and trial_end < now()
  and coalesce(stripe_subscription_status, '') not in ('trialing', 'active')
order by trial_end;

-- 2. Fix (uncomment after reviewing step 1)
-- update public.profiles
-- set trial_active = false, updated_at = now()
-- where trial_active = true
--   and trial_end < now()
--   and coalesce(stripe_subscription_status, '') not in ('trialing', 'active');
