# Legacy migrations (already applied by hand)

These used to live in `shearwork-web/supabase/migrations/`, where the Supabase CLI never
saw them. Their changes are already in the production database. They are kept for history
only and are **not** in `supabase/migrations/`, so `supabase db push` will not re-run them
(`20260123_insert_feature_updates.sql` would insert duplicate rows).

Going forward, schema changes go in `supabase/migrations/` (see `../README.md`).
