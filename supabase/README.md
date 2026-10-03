# Supabase

- `migrations/` — the only folder the Supabase CLI applies (`supabase db push`).
- `functions/` — edge functions.
- `manual/` — review-only SQL to run by hand (never applied automatically).
- `legacy-migrations/` — old SQL that was applied by hand before the CLI was set up.

## Getting a real baseline

There is no baseline migration of the existing schema yet (a previous `supabase db pull`
produced an empty file because Docker was not available). On a machine with Docker:

```bash
supabase link --project-ref <project-ref>
supabase db pull            # writes migrations/<timestamp>_remote_schema.sql
supabase gen types typescript --linked > ../shearwork-web/lib/database.types.ts
```

`db pull` names the baseline with the current timestamp, which sorts after
`20261003020000_credits_and_profile_hardening.sql`. If that migration is not applied yet,
apply it first (`supabase db push`) and then pull, so the baseline includes it.

## Pending migration: `20261003020000_credits_and_profile_hardening.sql`

Adds `adjust_credits()`, `credit_transactions.idempotency_key`,
`sms_scheduled_messages.credits_reserved` and a trigger that stops users editing billing,
credit, trial and admin fields on their own profile. Apply it before (or together with)
deploying the matching app changes. The app falls back to the old credit logic if the
function is missing, but campaign reservations are only tracked once the column exists.
