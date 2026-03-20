"use client";

import { useState, useMemo } from "react";
import { DocSection, DocTabShell, DocEntry, JumpHandler } from "./DocCard";

// ─── API route entries ────────────────────────────────────────────────────────
const API_ENTRIES: DocEntry[] = [
  // ── acuity ──────────────────────────────────────────────────────────────────
  {
    id: "api-acuity-appointment-webhook",
    name: "appointment-webhook",
    path: "/app/api/acuity/appointment-webhook/route.ts",
    summary: "Receives Acuity scheduling events and triggers downstream updates.",
    description: "POST endpoint called by Acuity whenever an appointment is scheduled, rescheduled, or canceled. Looks up the barber by calendar_id from acuity_tokens, fetches full appointment details from the Acuity API, then: (1) runs SMS campaign attribution via updateSmsBarberSuccess, (2) updates the client's next_future_appointment via updateBarberClient, and (3) refreshes open-booking availability for the relevant ISO week(s) via pullAvailability.",
    tags: ["acuity", "webhook"],
    related: [
      { label: "updateSmsBarberSuccess", type: "lib", targetId: "lib-update-sms-barber-success" },
      { label: "updateBarberClient", type: "lib", targetId: "lib-update-barber-client" },
      { label: "pullAvailability (orchestrator)", type: "lib", targetId: "lib-availability-orchestrator" },
    ],
  },

  // ── barber-nudge ────────────────────────────────────────────────────────────
  {
    id: "api-barber-nudge-root",
    name: "barber-nudge",
    path: "/api/barber-nudge/route.ts",
    summary: "Twilio webhook — fires when a barber replies 'yes' to the weekly nudge SMS.",
    description: "Receives inbound Twilio SMS webhooks. Ignores any reply that isn't 'yes'. Looks up the barber by normalized phone, validates active subscription/trial, guards against double-engagement (sms_engaged_current_week), logs the reply to sms_replies, flips the engagement flag on profiles, then calls createSmartBuckets to build the week's client send list. Inserts a notification on success.",
    tags: ["barber-nudge", "webhook"],
    related: [
      { label: "createSmartBuckets", type: "lib", targetId: "lib-create-smart-buckets" },
      { label: "manual-smart-bucket", type: "api", targetId: "api-barber-nudge-manual-smart-bucket" },
    ],
  },
  {
    id: "api-barber-nudge-manual-smart-bucket",
    name: "manual-smart-bucket",
    path: "/api/barber-nudge/manual-smart-bucket/route.ts",
    summary: "Manually triggers smart bucket creation for the authenticated barber.",
    description: "Authenticated POST endpoint that replicates the barber-nudge webhook flow without requiring an inbound SMS. Validates subscription/trial access, guards against double-engagement, logs a manual trigger to sms_replies, flips sms_engaged_current_week on profiles, and calls createSmartBuckets. Used from the dashboard UI to let barbers authorize their weekly nudge manually.",
    tags: ["barber-nudge"],
    related: [
      { label: "createSmartBuckets", type: "lib", targetId: "lib-create-smart-buckets" },
      { label: "barber-nudge (webhook)", type: "api", targetId: "api-barber-nudge-root" },
    ],
  },
  {
    id: "api-barber-nudge-sms-status",
    name: "sms-status",
    path: "/api/barber-nudge/sms-status/route.ts",
    summary: "Twilio status callback for barber-facing SMS (approval & update messages).",
    description: "Receives Twilio delivery status callbacks for barber SMS (purpose: barber_sms or barber_sms_update). Reads user_id, message, and purpose from query params. On 'delivered' inserts a success row into sms_sent. On 'failed' or 'undelivered' translates the Twilio error code to a human-readable reason and inserts a failure row. Other statuses (queued, sent) are ignored.",
    tags: ["barber-nudge", "webhook"],
    related: [
      { label: "sms-status-client", type: "api", targetId: "api-barber-nudge-sms-status-client" },
    ],
  },
  {
    id: "api-barber-nudge-sms-status-client",
    name: "sms-status-client",
    path: "/api/barber-nudge/sms-status-client/route.ts",
    summary: "Twilio status callback for client-facing nudge SMS.",
    description: "Receives Twilio delivery status callbacks for client SMS (purpose: client_sms_barber_nudge). Reads user_id, client_id, message, and message_id (smart_bucket_id) from query params. On 'delivered' inserts a success row into sms_sent and stamps date_last_sms_sent on the acuity_clients record. On 'failed' or 'undelivered' inserts a failure row and sets sms_subscribed = false on the client.",
    tags: ["barber-nudge", "webhook"],
    related: [
      { label: "sms-status", type: "api", targetId: "api-barber-nudge-sms-status" },
      { label: "client-reply-webhook", type: "api", targetId: "api-barber-nudge-client-reply-webhook" },
    ],
  },
  {
    id: "api-barber-nudge-client-reply-webhook",
    name: "client-reply-webhook",
    path: "/api/barber-nudge/client-reply-webhook/route.ts",
    summary: "Twilio webhook — logs replies from clients who respond to nudge SMS.",
    description: "Receives inbound Twilio SMS from clients. Normalizes the client's phone number, looks up the most recent delivered sms_sent row for that phone to resolve user_id and client_id, then inserts a row into sms_replies with source='client-reply'. This powers the client engagement tracking visible in NudgeEngagementPage and ClientMessageHistory.",
    tags: ["barber-nudge", "webhook"],
    related: [
      { label: "sms-status-client", type: "api", targetId: "api-barber-nudge-sms-status-client" },
    ],
  },
  {
    id: "api-barber-nudge-fallback",
    name: "fallback",
    path: "/api/barber-nudge/fallback/route.ts",
    summary: "Fallback webhook handler — logs failed webhook attempts.",
    description: "Safety-net POST endpoint configured as a fallback in Twilio. When the primary webhook fails, Twilio calls this route. Logs the raw payload to webhook_failures with error_message='Primary webhook failed'. Does not attempt any retry logic — purely a logging sink for debugging missed webhooks.",
    tags: ["barber-nudge", "webhook"],
    related: [
      { label: "barber-nudge (webhook)", type: "api", targetId: "api-barber-nudge-root" },
    ],
  },

  // ── nudge (dev/debug) ────────────────────────────────────────────────────────
  {
    id: "api-nudge-compare-scoring",
    name: "compare-scoring",
    path: "/app/api/nudge/compare-scoring/route.ts",
    summary: "Dev tool — compares client scores with and without holiday boost.",
    description: "GET endpoint for debugging the AutoNudge scoring algorithm. Fetches eligible clients for a given userId, runs calculateBaseScore (mirrors clientSmsSelectionAlgorithm logic) and calculateHolidaySensitivityBatch, then returns a side-by-side rank comparison showing which clients moved into or out of the top 10 due to the active holiday boost. Includes a top10Comparison object and a selectionImpact summary.",
    tags: ["nudge", "debug"],
    related: [
      { label: "holidayCalendar", type: "lib", targetId: "lib-holiday-calendar" },
      { label: "calculateHolidaySensitivity", type: "lib", targetId: "lib-calculate-holiday-sensitivity" },
      { label: "test-holiday-sensitivity", type: "api", targetId: "api-nudge-test-holiday-sensitivity" },
    ],
  },
  {
    id: "api-nudge-test-holiday-sensitivity",
    name: "test-holiday-sensitivity",
    path: "/app/api/nudge/test-holiday-sensitivity/route.ts",
    summary: "Dev tool — inspects holiday sensitivity scores for a user's clients.",
    description: "GET endpoint for testing the holiday sensitivity calculation in isolation. Accepts an optional forceHoliday param to override the active holiday. Returns diagnostics (all holidays, activation windows, lookback ranges), per-client boost and matchedLastYear values, and a summary of how many clients were boosted. Useful for verifying the lookback window and boost amount without running a full nudge cycle.",
    tags: ["nudge", "debug"],
    related: [
      { label: "holidayCalendar", type: "lib", targetId: "lib-holiday-calendar" },
      { label: "calculateHolidaySensitivity", type: "lib", targetId: "lib-calculate-holiday-sensitivity" },
      { label: "compare-scoring", type: "api", targetId: "api-nudge-compare-scoring" },
    ],
  },
  // ── availability ────────────────────────────────────────────────────────────
  {
    id: "api-availability-pull",
    name: "availability/pull",
    path: "/app/api/availability/pull/route.ts",
    summary: "Authenticated endpoint that pulls and upserts barber availability slots.",
    description: "GET endpoint called by update_barber_availability edge function (and directly from the dashboard). Authenticates via getAuthenticatedUser, then delegates to pullAvailability from lib/booking/availability/orchestrator. Accepts dryRun, forceRefresh, mode=update, and week=next|prev query params. Returns the raw result from pullAvailability including slot counts and date range. This is the main entry point for keeping availability_slots and availability_daily_summary fresh.",
    tags: ["availability"],
    related: [
      { label: "pullAvailability (orchestrator)", type: "lib", targetId: "lib-availability-orchestrator" },
      { label: "update_barber_availability", type: "edge", targetId: "edge-update-barber-availability" },
    ],
  },

  // ── openai ───────────────────────────────────────────────────────────────────
  {
    id: "api-openai-generate",
    name: "openai/generate",
    path: "/app/api/openai/generate/route.ts",
    summary: "Generates weekly, weekly_comparison, or monthly AI reports for a barber.",
    description: "POST endpoint called by generate_monthly_report and generate_weekly_report edge functions. Accepts type (monthly/rental, weekly/commission, weekly_comparison/rental, etc.), user_id, month, year, and week_number. Fetches data from daily_data, weekly_data, monthly_data, service_bookings, weekly_service_bookings, acuity_appointments (for tips), acuity_clients (for marketing funnels), weekly_top_clients, report_top_clients, and recurring_expenses. Computes services_percentage and marketing funnel retention rates inline. Passes the assembled dataset to the appropriate prompt template from /api/openai/prompts, calls OpenAI (gpt-4o-mini), inserts the HTML report into reports, and inserts a notification.",
    tags: ["openai"],
    related: [
      { label: "generate_monthly_report", type: "edge", targetId: "edge-generate-monthly-report" },
      { label: "generate_weekly_report", type: "edge", targetId: "edge-generate-weekly-report" },
      { label: "generate_weekly_comparison", type: "edge", targetId: "edge-generate-weekly-comparison" },
    ],
  },

  // ── client-messaging ─────────────────────────────────────────────────────────
  {
    id: "api-client-messaging-preview-recipients",
    name: "preview-recipients",
    path: "/app/api/client-messaging/preview-recipients/route.ts",
    summary: "Returns scored client lists for auto-nudge, campaign, or mass SMS algorithms.",
    description: "GET/POST endpoint that routes to one of three selection algorithms based on the algorithm query param: auto-nudge → selectClientsForSMS_AutoNudge, campaign → selectClientsForSMS_Campaign, mass → selectClientsForSMS_Mass. Also accepts visitingType, limit, and messageId params. Returns clients array, phoneNumbers array, deselectedClients, stats (avg score, days overdue, breakdown by visiting_type), and totalAvailableClients. Called by createSmartBuckets (lib) and qstash-sms-send during campaign execution.",
    tags: ["client-messaging"],
    related: [
      { label: "clientSmsSelectionAlgorithm_AutoNudge", type: "lib", targetId: "lib-client-sms-selection-autonudge" },
      { label: "clientSmsSelectionAlgorithm_Campaign", type: "lib", targetId: "lib-client-sms-selection-campaign" },
      { label: "clientSmsSelectionAlgorithm_Mass", type: "lib", targetId: "lib-client-sms-selection-mass" },
      { label: "createSmartBuckets", type: "lib", targetId: "lib-create-smart-buckets" },
      { label: "qstash-sms-send", type: "api", targetId: "api-client-messaging-qstash-sms-send" },
    ],
  },
  {
    id: "api-client-messaging-qstash-sms-send",
    name: "qstash-sms-send",
    path: "/app/api/client-messaging/qstash-sms-send/route.ts",
    summary: "QStash-verified endpoint that orchestrates a full campaign SMS send.",
    description: "POST endpoint triggered by QStash (verified via verifySignatureAppRouter). Handles both test sends (action=test, sends to barber's own phone and deducts 1 credit) and scheduled sends (ACCEPTED status). For scheduled sends: fetches recipients from preview-recipients, updates final_clients_to_message on sms_scheduled_messages, kicks off a recursive progress tracking chain via QStash → check-sms-progress, then enqueues one job per recipient to /api/client-messaging/enqueue-sms via a per-user QStash queue (concurrency=15 via pMap). For auto-nudge sends: calls pullAvailability to get fresh slots, filters recipients by service availability, and appends slot suggestions to each message. Respects start_date/end_date campaign windows.",
    tags: ["client-messaging"],
    related: [
      { label: "preview-recipients", type: "api", targetId: "api-client-messaging-preview-recipients" },
      { label: "enqueue-sms", type: "api", targetId: "api-client-messaging-enqueue-sms" },
      { label: "check-sms-progress", type: "api", targetId: "api-client-messaging-check-sms-progress" },
      { label: "save-sms-schedule", type: "api", targetId: "api-client-messaging-save-sms-schedule" },
      { label: "pullAvailability (orchestrator)", type: "lib", targetId: "lib-availability-orchestrator" },
    ],
  },
  {
    id: "api-client-messaging-enqueue-sms",
    name: "enqueue-sms",
    path: "/app/api/client-messaging/enqueue-sms/route.ts",
    summary: "QStash-verified leaf endpoint — sends a single SMS via Twilio.",
    description: "POST endpoint called by qstash-sms-send via a per-user QStash queue. QStash signature is verified via verifySignatureAppRouter. Receives user_id, messageId, purpose, message, and phone_normalized in the body. Creates a Twilio message using the shared messaging service SID with a status callback to /api/client-messaging/sms-status. This is the actual leaf node of the campaign send pipeline — all the orchestration lives upstream in qstash-sms-send.",
    tags: ["client-messaging"],
    related: [
      { label: "qstash-sms-send", type: "api", targetId: "api-client-messaging-qstash-sms-send" },
      { label: "client-messaging/sms-status", type: "api", targetId: "api-client-messaging-sms-status" },
    ],
  },
  {
    id: "api-client-messaging-sms-status",
    name: "client-messaging/sms-status",
    path: "/app/api/client-messaging/sms-status/route.ts",
    summary: "Twilio status callback for campaign/mass/test SMS delivery.",
    description: "POST endpoint receiving Twilio delivery callbacks for client-facing campaign messages. Reads messageId, user_id, and purpose from query params. On 'delivered': stamps date_last_sms_sent on acuity_clients (non-test), inserts a success row into sms_sent with message and cron from sms_scheduled_messages. On 'undelivered' (error 21610/STOP): sets sms_subscribed=false and inserts a failure row. On 'failed'/'undelivered': inserts failure row, handles credit refund for test messages (only after the 10th daily test). Different from /api/barber-nudge/sms-status which is for barber-facing SMS.",
    tags: ["client-messaging"],
    related: [
      { label: "enqueue-sms", type: "api", targetId: "api-client-messaging-enqueue-sms" },
      { label: "check-sms-progress", type: "api", targetId: "api-client-messaging-check-sms-progress" },
      { label: "sms-status (barber)", type: "api", targetId: "api-barber-nudge-sms-status" },
    ],
  },
  {
    id: "api-client-messaging-check-sms-progress",
    name: "check-sms-progress",
    path: "/app/api/client-messaging/check-sms-progress/route.ts",
    summary: "Recursive QStash polling loop — tracks campaign send progress and finalizes credits.",
    description: "POST endpoint kicked off by qstash-sms-send after a campaign starts. Counts successful and failed sms_sent rows for the message_id. If not all messages have been sent yet (totalCount < final_clients_to_message), re-schedules itself via QStash with a 3-second delay. When complete: marks sms_scheduled_messages as is_finished=true, calculates credit deductions (only for non-auto-nudge purposes) — reserves are released, underflow (limit - final_clients_to_message) and failed messages are refunded to available_credits, logs a credit_transactions row, and inserts a completion notification. Auto-nudge campaigns are free and skip the credit logic.",
    tags: ["client-messaging"],
    related: [
      { label: "qstash-sms-send", type: "api", targetId: "api-client-messaging-qstash-sms-send" },
      { label: "client-messaging/sms-status", type: "api", targetId: "api-client-messaging-sms-status" },
    ],
  },
  {
    id: "api-client-messaging-save-sms-schedule",
    name: "save-sms-schedule",
    path: "/app/api/client-messaging/save-sms-schedule/route.ts",
    summary: "Creates, updates, and deletes QStash schedules for recurring and one-time campaigns.",
    description: "Multi-method authenticated endpoint. POST: upserts sms_scheduled_messages rows and manages QStash schedules. For one-time campaigns (scheduledFor present): publishes a QStash message with a delay calculated from the scheduled datetime. For recurring (frequency + dayOfWeek/dayOfMonth): generates cron expression(s) via generateCronExpressions (handles days 29–31 edge cases across months) and creates QStash schedules with CRON_TZ=America/Toronto prefix. On ACCEPTED status, reserves credits from available_credits to reserved_credits. DELETE: removes QStash schedules or messages (distinguishes recurring vs one-time by ISO date format in cron field), then soft-deletes or hard-deletes the DB row. GET: fetches scheduled messages filtered by purpose array and optional excludeDeleted.",
    tags: ["client-messaging"],
    related: [
      { label: "qstash-sms-send", type: "api", targetId: "api-client-messaging-qstash-sms-send" },
      { label: "qstash_schedule_check", type: "api", targetId: "api-client-messaging-qstash-schedule-check" },
    ],
  },
  {
    id: "api-client-messaging-qstash-schedule-check",
    name: "qstash_schedule_check",
    path: "/app/api/client-messaging/qstash_schedule_check/route.ts",
    summary: "Admin utility — inspects and deletes QStash schedules, messages, events, and DLQ.",
    description: "GET/DELETE admin endpoint for inspecting the QStash state. GET without params fetches all schedules, events, and DLQ messages from the QStash API. GET with scheduleId or messageId fetches that specific item. DELETE with scheduleId or messageId (and type=schedules|messages) deletes the specified item from QStash. Used for debugging stuck campaigns, inspecting the DLQ for failed deliveries, and manually cleaning up orphaned schedules.",
    tags: ["client-messaging"],
    related: [
      { label: "save-sms-schedule", type: "api", targetId: "api-client-messaging-save-sms-schedule" },
    ],
  },
  {
    id: "api-client-messaging-generate-sms-template",
    name: "generate-sms-template",
    path: "/app/api/client-messaging/generate-sms-template/route.ts",
    summary: "Generates an AI SMS marketing message for a barber using OpenAI.",
    description: "POST endpoint called by ClientSMSFromBarberNudge (legacy) and the campaign composer UI. Accepts a prompt string and a profile object (full_name, email, phone, booking_link). Calculates a dynamic character budget (240 minus profile field lengths) and passes strict character limit instructions to gpt-4o-mini. System prompt enforces no emojis, early name mention, and friendly/informal tone. Returns the generated message string. Auth is commented out — currently open.",
    tags: ["client-messaging"],
    related: [
      { label: "ClientSMSFromBarberNudge (index)", type: "lib", targetId: "lib-client-sms-index" },
      { label: "verify-message", type: "api", targetId: "api-client-messaging-verify-message" },
    ],
  },
  {
    id: "api-client-messaging-verify-message",
    name: "verify-message",
    path: "/app/api/client-messaging/verify-message/route.ts",
    summary: "AI content moderation — validates a user-written SMS message before scheduling.",
    description: "Authenticated POST endpoint. Enforces hard rules (100-char minimum, 240-char maximum, no emojis) before hitting OpenAI. Passes the message to gpt-4o-mini with a lenient content moderation prompt — only rejects truly harmful content, allows links, promotional language, informal tones, and personal contact info. Parses the AI response (format: 'ACCEPTED | reason' or 'DENIED | reason') and returns approved boolean, status, and reason. Called from the campaign composer before a message can be scheduled.",
    tags: ["client-messaging"],
    related: [
      { label: "generate-sms-template", type: "api", targetId: "api-client-messaging-generate-sms-template" },
      { label: "save-sms-schedule", type: "api", targetId: "api-client-messaging-save-sms-schedule" },
    ],
  },
  {
    id: "api-client-messaging-get-auto-nudge-recipients",
    name: "get-auto-nudge-recipients",
    path: "/app/api/client-messaging/get-auto-nudge-recipients/route.ts",
    summary: "Returns auto-nudge campaign history or per-run recipient lists.",
    description: "Authenticated GET endpoint with two modes. Mode 1 (messageId + message + cron provided): fetches all sms_sent rows for that specific campaign run, joins with acuity_clients for first/last names, and returns recipients with stats (total/successful/failed) and a human-readable cron description. Mode 2 (userId only): fetches all auto-nudge campaign history from sms_sent joined with sms_scheduled_messages (purpose=auto-nudge), groups by message_id+message+cron, and returns a list of campaign summaries sorted by most recent. Used by the AutoNudgeHistory component.",
    tags: ["client-messaging"],
    related: [
      { label: "client-messaging/sms-status", type: "api", targetId: "api-client-messaging-sms-status" },
    ],
  },
  {
    id: "api-client-messaging-get-campaign-progress",
    name: "get-campaign-progress",
    path: "/app/api/client-messaging/get-campaign-progress/route.ts",
    summary: "Returns send progress and per-recipient details for one or more campaigns.",
    description: "GET endpoint with two modes depending on query params. When only userId and optional messageIds are provided: returns lightweight progress objects (success, fail, total, expected, percentage, is_finished, is_active) for each matching sms_scheduled_messages row. When userId and messageId are both provided: fetches all sms_sent rows for that specific message, joins with acuity_clients for client names, and returns per-recipient status with stats. Used by the campaign UI to poll send progress in real time.",
    tags: ["client-messaging"],
    related: [
      { label: "check-sms-progress", type: "api", targetId: "api-client-messaging-check-sms-progress" },
      { label: "client-messaging/sms-status", type: "api", targetId: "api-client-messaging-sms-status" },
    ],
  },
];

// ─── Group entries by their top-level folder under /api ───────────────────────
function groupByFolder(entries: DocEntry[]): Record<string, DocEntry[]> {
  const groups: Record<string, DocEntry[]> = {};
  for (const entry of entries) {
    const parts = entry.path.replace(/^\/(app\/)?api\//, "").split("/");
    const folder = parts.length > 1 ? parts[0] : "root";
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(entry);
  }
  return groups;
}

export default function ApiDocs({
  highlightedId,
  onJump,
}: {
  highlightedId?: string;
  onJump?: JumpHandler;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return API_ENTRIES;
    const q = search.toLowerCase();
    return API_ENTRIES.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.path.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [search]);

  const groups = useMemo(() => groupByFolder(filtered), [filtered]);

  return (
    <DocTabShell
      icon="⬡"
      title="API Routes"
      subtitle="Vercel serverless route handlers under /app/api"
      searchPlaceholder="Search routes..."
      searchValue={search}
      onSearchChange={setSearch}
    >
      {Object.keys(groups).length === 0 ? (
        <p className="text-sm text-[#9ca89a] text-center py-12">No routes match your search.</p>
      ) : (
        Object.entries(groups).map(([folder, entries]) => (
          <DocSection
            key={folder}
            title={folder === "root" ? "Root" : `/${folder}`}
            entries={entries}
            highlightedId={highlightedId}
            onJump={onJump}
          />
        ))
      )}
    </DocTabShell>
  );
}