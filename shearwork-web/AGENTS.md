# AGENTS.md

## Scope
- Applies to the repository root and subdirectories.
- Update this file when tooling or conventions change.

## Stack
- Next.js App Router (React 19, TypeScript, ESLint).
- Tailwind CSS 4 for styling.
- Supabase for auth/data; Square + Acuity integrations.

## Commands (npm)
- `npm install` — install dependencies.
- `npm run dev` — start Next.js dev server.
- `npm run build` — production build.
- `npm run start` — run production server.
- `npm run lint` — ESLint (Next core-web-vitals + TS rules).
- `npm run type-check` — TypeScript `tsc --noEmit`.

## Single-File / Targeted Checks
- No unit-test framework is configured in this repo.
- Use per-file linting as the closest “single test”:
- `npm run lint -- path/to/file.ts`.
- `npx eslint path/to/file.ts` also works.
- TypeScript only runs project-wide: `npm run type-check`.
- If you add a test runner, document single-test commands here.

## Repo Layout
- `app/` — Next.js App Router pages, layouts, and API routes.
- `app/api/**/route.ts` — server endpoints (GET/POST/etc.).
- `components/` — reusable UI components.
- `contexts/` — React context providers.
- `hooks/` — React hooks.
- `lib/` — business logic, adapters, data clients.
- `utils/` — shared helpers (auth, formatting, etc.).

## Architecture Notes (Integrations)
- Booking sync is abstracted by `lib/booking`.
- `BookingAdapter` defines external system adapters.
- `orchestrator.ts` coordinates fetch → normalize → process → aggregate.
- `processors/clients.ts` resolves client identity and upserts.
- `processors/appointments.ts` upserts appointments with revenue preservation.
- `processors/aggregations/` handles daily/weekly/monthly rollups.
- When adding Square sync, prefer adapter + orchestrator path.

## Imports
- Prefer absolute imports using the `@/` alias (`tsconfig.json`).
- Order imports: external libs → internal `@/` → relative.
- Use `import type { ... }` for type-only imports.
- Avoid deep relative paths like `../../../` when `@/` is available.
- Keep `next/server` imports for route handlers (`NextResponse`).

## Formatting
- Match the existing file’s formatting; avoid reformatting.
- Most files use single quotes and trailing commas in multiline objects.
- Preserve indentation style in the file (tabs vs spaces).
- Wrap long objects/params for readability.
- No Prettier config is present; do not add one unless requested.

## TypeScript
- `strict: true` is enabled; avoid `any` where possible.
- If `any` is unavoidable, narrow its scope and add context.
- Prefer `unknown` in `catch` blocks and narrow with `instanceof`.
- Use explicit return types for exported functions when non-trivial.
- Keep shared types in `lib/booking/types.ts` and `lib/*/types.ts`.

## Naming
- `PascalCase` for React components and classes.
- `camelCase` for functions, variables, and hooks.
- `UPPER_SNAKE_CASE` for module-level constants.
- Database tables/columns use `snake_case`; mirror in DB payloads.
- API routes must be `app/api/**/route.ts`.

## React / Next.js Conventions
- Server Components are default; use `'use client'` only when needed.
- Some server routes include `'use server'`; keep it if present.
- Keep providers in `app/layout.tsx` or `contexts/`.
- Use `NextResponse.json()` or `Response.json()` in API routes.
- Prefer colocating route logic in `lib/` to keep handlers thin.

## Styling
- Tailwind CSS is present; prefer utility classes.
- Keep `className` strings readable (wrap long lists).
- Avoid adding new CSS frameworks unless asked.

## Error Handling
- Validate auth via `getAuthenticatedUser` and return 401 on failure.
- Check Supabase errors and return 400/500 with JSON body.
- Log errors with context (`console.error('context', err)`).
- Do not expose secrets or raw tokens in logs or responses.

## Supabase Usage
- Use `createSupabaseServerClient` in server contexts.
- Token rows live in `acuity_tokens` and `square_tokens`.
- Always scope DB queries by `user_id`.
- Upsert with `onConflict` to avoid duplicates.
- For bulk updates, prefer `upsert` over per-row `insert`.

## External API Usage
- Square calls must include `Square-Version` header.
- Acuity uses OAuth refresh; check `expires_at` before requests.
- Handle pagination with `cursor`/`limit` loops and short delays.
- Normalize to ISO dates (`YYYY-MM-DD`) for storage.

## Dates / Time
- Prefer `toISOString()` and date-only `YYYY-MM-DD` fields.
- Use `date-fns` or `dayjs` only if adjacent code already does.

## Data Integrity Patterns
- Preserve manual edits to revenue/tip during appointment sync.
- Maintain `first_appt`, `second_appt`, `last_appt` tracking.
- Use normalization helpers for phone/email/name matching.
- Keep per-user scoping (`user_id`) on all DB operations.

## Performance
- Batch Supabase queries when dealing with large ID lists.
- Avoid N+1 loops when you can `in()` query instead.
- Add small delays for external API pagination to avoid rate limits.

## Security
- Never commit `.env` or secrets.
- Service-role requests use `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
- When using service role, supply `x-user-id` where required.

## Linting
- ESLint is configured via `eslint.config.mjs`.
- Fix lint warnings in touched files only.

## Testing
- No unit/integration test framework is configured.
- Use `npm run lint` + `npm run type-check` as validation.
- If tests are added, document how to run a single test.

## Documentation
- Do not add new docs unless requested.
- If you change developer workflows, update this file.

## Cursor / Copilot Rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.
- If these are added later, include them here.

## When Adding Square Sync
- Prefer implementing `lib/booking/adapters/square.ts`.
- Normalize Square entities in `lib/square/normalize.ts`.
- Use orchestrator + processors to keep analytics consistent.

## When Adding Acuity Sync
- Reuse `lib/booking` processors instead of duplicating logic.
- Keep API routes thin; move heavy logic into `lib/`.

## Misc
- Respect existing file organization and naming.
- Keep changes minimal and targeted.
- Update `AGENTS.md` when conventions change.
