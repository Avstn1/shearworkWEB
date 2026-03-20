"use client";

import { useState, useMemo } from "react";
import { DocSection, DocTabShell, DocEntry, JumpHandler } from "./DocCard";

const EDGE_ENTRIES: DocEntry[] = [

  // ── nudge ───────────────────────────────────────────────────────────────────
  {
    id: "edge-barber-nudge-sms",
    name: "barber_nudge_sms",
    path: "/supabase/functions/barber_nudge_sms/index.ts",
    summary: "Sends the weekly 'do you want me to fill your slots?' SMS to eligible barbers.",
    description: "Scheduled Deno edge function (runs Mon–Thu). Skips Fri–Sun entirely. Monday flow: sends to barbers whose date_autonudge_enabled predates Monday 00:00 Toronto time (signed up Thu–Sun). Tue–Thu flow: sends only to barbers whose date_autonudge_enabled was yesterday (catchup for new signups). Filters for active subscription/trial, sms_engaged_current_week=false, and non-null phone. Reads weekly slot_count from availability_daily_summary and injects it into a randomly selected message template. Sends via Twilio with a status callback to /api/barber-nudge/sms-status (purpose=barber_sms).",
    tags: ["nudge"],
    related: [
      { label: "sms-status", type: "api", targetId: "api-barber-nudge-sms-status" },
      { label: "barber_nudge_update", type: "edge", targetId: "edge-barber-nudge-update" },
      { label: "update_barber_availability", type: "edge", targetId: "edge-update-barber-availability" },
    ],
  },
  {
    id: "edge-barber-nudge-update",
    name: "barber_nudge_update",
    path: "/supabase/functions/barber_nudge_update/index.ts",
    summary: "Sends the Wednesday results update SMS to barbers who authorized their nudge.",
    description: "Two-flow edge function. Flow 1 (Wednesday only): queries profiles with sms_engaged_current_week=true and date_autonudge_enabled before Monday 10am. Filters out 'barely late' barbers (latest 'yes' reply was Tue or later) — handled by Flow 2. Calls updateBarbersAvailability then sends each eligible barber a message with reply count, booking count, and revenue from sms_replies and barber_nudge_success. Flow 2 (Tue–Thu): fires on days where 'two days ago' falls in the Tue–Thu window, finds barbers who replied 'yes' on Tue–Fri this week and sends them a delayed update. Both flows use sms-status callback (purpose=barber_sms_update) and insert a notification on success.",
    tags: ["nudge"],
    related: [
      { label: "sms-status", type: "api", targetId: "api-barber-nudge-sms-status" },
      { label: "barber_nudge_sms", type: "edge", targetId: "edge-barber-nudge-sms" },
      { label: "update_barber_availability", type: "edge", targetId: "edge-update-barber-availability" },
    ],
  },
  {
    id: "edge-send-sms-smart-bucket",
    name: "send_sms_smart_bucket",
    path: "/supabase/functions/send_sms_smart_bucket/index.ts",
    summary: "pg_cron-driven function that sends client nudge SMS in time-bucketed batches.",
    description: "Core client SMS sending engine. Fetches all active sms_smart_buckets for the current ISO week. For each bucket, evaluates each client's appointment_datecreated_bucket (e.g. 'Monday|Morning') against the current Toronto day and batch window. Batch windows: Morning (18:30–19:30 UTC), Midday, Afternoon (16:00–17:00), Night (20:00–21:00). Skips clients who previously failed (permanent), were messaged in the last 10 days (dedup), or whose day/time hasn't arrived. Sends via Twilio with callbacks to /api/barber-nudge/sms-status-client. Inserts into sms_sent on both success and failure, updates messages_failed on the bucket. Supports INSTANT and MANUAL modes.",
    tags: ["nudge"],
    related: [
      { label: "sms-status-client", type: "api", targetId: "api-barber-nudge-sms-status-client" },
      { label: "createSmartBuckets", type: "lib", targetId: "lib-create-smart-buckets" },
      { label: "client-reply-webhook", type: "api", targetId: "api-barber-nudge-client-reply-webhook" },
    ],
  },

  // ── appointments ────────────────────────────────────────────────────────────
  {
    id: "edge-appointments-look-ahead",
    name: "appointments_look_ahead",
    path: "/supabase/functions/appointments_look_ahead/index.ts",
    summary: "Scans upcoming Acuity appointments and attributes bookings to SMS buckets.",
    description: "Scheduled function that checks all barbers with active sms_smart_buckets in the last 2 ISO weeks. For each barber, fetches appointments from Acuity (7 days ago → 2 months ahead, max 1000) and runs backfillNextFutureAppointment to keep acuity_clients.next_future_appointment fresh. Then for each bucket, cross-references client phones against appointments created after campaign_start — any match gets attributed. Upserts barber_nudge_success rows with merged client_ids, services, prices, and appointment_dates arrays (deduplicates by client_id). Also tracks clicked_link count via last_date_clicked_link. Accepts optional user_id query param. Concurrency capped at 100.",
    tags: ["appointments"],
    related: [
      { label: "updateBarberClient", type: "lib", targetId: "lib-update-barber-client" },
      { label: "updateSmsBarberSuccess", type: "lib", targetId: "lib-update-sms-barber-success" },
      { label: "backfill_next_future_appointment", type: "edge", targetId: "edge-backfill-next-future-appointment" },
      { label: "appointment-webhook", type: "api", targetId: "api-acuity-appointment-webhook" },
    ],
  },
  {
    id: "edge-backfill-next-future-appointment",
    name: "backfill_next_future_appointment",
    path: "/supabase/functions/backfill_next_future_appointment/index.ts",
    summary: "One-time / on-demand backfill for acuity_clients.next_future_appointment.",
    description: "Fetches all future Acuity appointments (today → 2 months ahead) for every barber with a calendar, normalizes phones to E.164, groups by phone keeping only the soonest appointment per client, then updates next_future_appointment using sooner-wins logic. Returns per-user updated vs. skipped counts. Concurrency capped at 5 to avoid hammering the Acuity API. Accepts user_id query param for targeted single-user runs. Lighter version of the same backfill logic embedded in appointments_look_ahead.",
    tags: ["appointments"],
    related: [
      { label: "appointments_look_ahead", type: "edge", targetId: "edge-appointments-look-ahead" },
      { label: "updateBarberClient", type: "lib", targetId: "lib-update-barber-client" },
    ],
  },

  // ── availability ─────────────────────────────────────────────────────────────
  {
    id: "edge-update-barber-availability",
    name: "update_barber_availability",
    path: "/supabase/functions/update_barber_availability/index.ts",
    summary: "Triggers availability pulls for all (or specific) barbers via /api/availability/pull.",
    description: "Orchestrator that fans out availability refresh requests. Accepts user_ids (array) or user_id (single) in the POST body for targeted updates, or runs all barbers with a calendar if no target is specified. When running as a full cron sweep (no target), also resets sms_engaged_current_week=false on all engaged profiles before firing. Calls /api/availability/pull per barber using SERVICE_ROLE_KEY as Bearer token and BYPASS_TOKEN for Vercel protection bypass. Concurrency capped at 100. Called by barber_nudge_sms and barber_nudge_update before sending messages to ensure slot counts are fresh.",
    tags: ["availability"],
    related: [
      { label: "availability/pull", type: "api", targetId: "api-availability-pull" },
      { label: "barber_nudge_sms", type: "edge", targetId: "edge-barber-nudge-sms" },
      { label: "barber_nudge_update", type: "edge", targetId: "edge-barber-nudge-update" },
    ],
  },

  // ── reports ──────────────────────────────────────────────────────────────────
  {
    id: "edge-generate-monthly-report",
    name: "generate_monthly_report",
    path: "/supabase/functions/generate_monthly_report/index.ts",
    summary: "Cron-triggered function — generates monthly reports for all barbers.",
    description: "Runs at midnight on the 1st of every month (cron: 0 0 1 * *). Targets the previous month (rolls back year if January). Fetches all profiles with role=Barber, then fires POST /api/openai/generate with type=monthly/{barber_type} for each one. Concurrency capped at 100. Authenticates with NEXT_PUBLIC_SUPABASE_ANON_KEY and BYPASS_TOKEN.",
    tags: ["reports"],
    related: [
      { label: "openai/generate", type: "api", targetId: "api-openai-generate" },
      { label: "generate_weekly_report", type: "edge", targetId: "edge-generate-weekly-report" },
      { label: "generate_weekly_comparison", type: "edge", targetId: "edge-generate-weekly-comparison" },
    ],
  },
  {
    id: "edge-generate-weekly-report",
    name: "generate_weekly_report",
    path: "/supabase/functions/generate_weekly_report/index.ts",
    summary: "Cron-triggered function — generates individual weekly reports for all barbers.",
    description: "Runs every Monday at midnight (cron: 0 0 * * 1). Determines the correct week number by finding today's date in the list of Mondays for the current month. If today is the first Monday of the month, rolls back to the previous month and uses its last week. Calls POST /api/openai/generate with type=weekly/{barber_type} and the resolved week_number for each barber. Concurrency capped at 100.",
    tags: ["reports"],
    related: [
      { label: "openai/generate", type: "api", targetId: "api-openai-generate" },
      { label: "generate_monthly_report", type: "edge", targetId: "edge-generate-monthly-report" },
      { label: "generate_weekly_comparison", type: "edge", targetId: "edge-generate-weekly-comparison" },
    ],
  },
  {
    id: "edge-generate-weekly-comparison",
    name: "generate_weekly_comparison",
    path: "/supabase/functions/generate_weekly_comparison/index.ts",
    summary: "Cron-triggered function — generates week-over-week comparison reports for all barbers.",
    description: "Runs every Monday at midnight (cron: 0 0 * * 1). Same month/week resolution logic as generate_weekly_report but subtracts 5 hours from now before computing the date (UTC→EST offset). If today is the first Monday of the month, rolls back to the previous month. Calls POST /api/openai/generate with type=weekly_comparison/{barber_type} and week_number=null (comparison includes all weeks up to the current one). Concurrency capped at 100.",
    tags: ["reports"],
    related: [
      { label: "openai/generate", type: "api", targetId: "api-openai-generate" },
      { label: "generate_monthly_report", type: "edge", targetId: "edge-generate-monthly-report" },
      { label: "generate_weekly_report", type: "edge", targetId: "edge-generate-weekly-report" },
    ],
  },
  {
    id: "edge-fullyear-sync-barbers",
    name: "fullyear_sync_barbers",
    path: "/supabase/functions/fullyear_sync_barbers/index.ts",
    summary: "Queues a full-year Acuity appointment sync for all barbers via QStash.",
    description: "One-shot backfill function. Fetches all users with both an acuity_token and a non-null calendar from profiles, then enqueues one QStash job per user per target year to /api/pull?granularity=year. Distributes jobs round-robin across 5 QStash queues (parallelism=2 each, 10 concurrent total). Accepts optional user_id and year in the POST body for targeted single-user runs. Uses SERVICE_ROLE_KEY and BYPASS_TOKEN in request headers. Retries=3 per job.",
    tags: ["reports"],
    related: [
      { label: "daily_sync_barbers", type: "edge", targetId: "edge-daily-sync-barbers" },
    ],
  },
  {
    id: "edge-daily-sync-barbers",
    name: "daily_sync_barbers",
    path: "/supabase/functions/daily_sync_barbers/index.ts",
    summary: "Daily cron — syncs the current month's Acuity appointments for all barbers.",
    description: "Runs daily (intended as a cron job). Fetches all users with acuity_tokens who also have a non-null calendar in profiles, then fires one GET request to /api/pull?granularity=month for each user for the current month and year. Uses concurrency=100. Authenticates with SERVICE_ROLE_KEY and BYPASS_TOKEN headers. Note: the URL in the source currently points to an ngrok dev tunnel — should be updated to the production Vercel URL before deploying.",
    tags: ["reports"],
    related: [
      { label: "fullyear_sync_barbers", type: "edge", targetId: "edge-fullyear-sync-barbers" },
    ],
  },

  // ── notifications ────────────────────────────────────────────────────────────
  {
    id: "edge-send-push-notification",
    name: "send-push-notification",
    path: "/supabase/functions/send-push-notification/index.ts",
    summary: "Database webhook — sends Expo push notifications on notifications INSERT.",
    description: "Triggered by a Supabase database webhook on INSERT into the notifications table. Fetches all push_tokens for the affected user_id, deduplicates them, builds Expo push messages with the notification's header, message, reference, and reference_type, then sends in batches of 100 to the Expo push API. Scans responses for DeviceNotRegistered or PushTokenInvalid errors and deletes those tokens from push_tokens. Skips gracefully if no tokens exist for the user.",
    tags: ["notifications"],
    related: [],
  },

  // ── debug ────────────────────────────────────────────────────────────────────
  {
    id: "edge-test-get-all-appointments",
    name: "test_get_all_appointments",
    path: "/supabase/functions/test_get_all_appointments/index.ts",
    summary: "Dev tool — fetches raw Acuity appointments for a given user and date range.",
    description: "Simple debug edge function. Accepts user_id as a query param, looks up the barber's access_token from acuity_tokens and calendar from profiles, then fetches appointments from the Acuity API for a hardcoded date range (currently Feb 2026). Returns the raw appointment JSON array with a count. Useful for inspecting Acuity's raw response format, phone number formats, and datetimeCreated values during debugging. The date range is hardcoded and should be updated before use.",
    tags: ["debug"],
    related: [
      { label: "appointments_look_ahead", type: "edge", targetId: "edge-appointments-look-ahead" },
    ],
  },
];

function groupByCategory(entries: DocEntry[]): Record<string, DocEntry[]> {
  const groups: Record<string, DocEntry[]> = {};
  for (const entry of entries) {
    const category = entry.tags?.[0] ?? "general";
    if (!groups[category]) groups[category] = [];
    groups[category].push(entry);
  }
  return groups;
}

export default function EdgeFunctionDocs({
  highlightedId,
  onJump,
}: {
  highlightedId?: string;
  onJump?: JumpHandler;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return EDGE_ENTRIES;
    const q = search.toLowerCase();
    return EDGE_ENTRIES.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.path.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [search]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <DocTabShell
      icon="◎"
      title="Edge Functions"
      subtitle="Supabase Deno edge functions — scheduled and event-driven"
      searchPlaceholder="Search edge functions..."
      searchValue={search}
      onSearchChange={setSearch}
    >
      {EDGE_ENTRIES.length === 0 ? (
        <p className="text-sm text-[#9ca89a] text-center py-12">No edge functions documented yet.</p>
      ) : Object.keys(groups).length === 0 ? (
        <p className="text-sm text-[#9ca89a] text-center py-12">No edge functions match your search.</p>
      ) : (
        Object.entries(groups).map(([category, entries]) => (
          <DocSection
            key={category}
            title={category}
            entries={entries}
            highlightedId={highlightedId}
            onJump={onJump}
          />
        ))
      )}
    </DocTabShell>
  );
}