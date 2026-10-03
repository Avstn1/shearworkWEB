-- Review-only helper (NOT a migration). Run by hand, after taking a backup.
--
-- None of these tables are referenced anywhere in shearwork-web or
-- supabase/functions (checked 2026-10-02). They are one-off backups from past data
-- migrations.
--
-- NOT listed here on purpose: the test_* tables. /api/pull?dryRun=true writes to them
-- through a table-name prefix (lib/booking/orchestrator.ts, tablePrefix 'test_').
--
-- Check pg_cron jobs, database functions and views for
-- references before dropping (the queries in step 1 help with that).

-- 1. Look for references inside the database
select p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.prosrc ilike '%test_%' or p.prosrc ilike '%migration_backup_%' or p.prosrc ilike '%_backup%');

select jobname, command from cron.job
where command ilike '%test_%' or command ilike '%backup%';

-- 2. Drop (uncomment after a backup and after step 1 comes back clean)
-- begin;
-- drop table if exists public.migration_backup_acuity_appointments;
-- drop table if exists public.migration_backup_daily_data;
-- drop table if exists public.migration_backup_marketing_funnels;
-- drop table if exists public.migration_backup_monthly_data;
-- drop table if exists public.migration_backup_report_top_clients;
-- drop table if exists public.migration_backup_service_bookings;
-- drop table if exists public.migration_backup_weekly_data;
-- drop table if exists public.migration_backup_weekly_marketing_funnels_base;
-- drop table if exists public.migration_backup_weekly_top_clients;
-- drop table if exists public.acuity_clients_backup_20260315;
-- drop table if exists public.profiles_backup;
-- commit;
--
-- Also unreferenced, but may be views feeding dashboards/BI - verify before dropping:
--   quarterly_revenue_summary, yearly_revenue_summary, yearly_top_clients,
--   report_overview, report_services, weekly_marketing_funnels
