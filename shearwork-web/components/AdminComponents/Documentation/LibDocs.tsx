"use client";

import { useState, useMemo } from "react";
import { DocSection, DocTabShell, DocEntry, JumpHandler } from "./DocCard";

// ─── Lib entries ──────────────────────────────────────────────────────────────
const LIB_ENTRIES: DocEntry[] = [

  // ── appointment_processors ──────────────────────────────────────────────────
  {
    id: "lib-update-barber-client",
    name: "updateBarberClient",
    path: "/lib/appointment_processors/update_barber_client.ts",
    summary: "Updates a client's next_future_appointment when Acuity fires a scheduling event.",
    description: "Called by the Acuity webhook on appointment.scheduled, appointment.rescheduled, and appointment.canceled. Normalizes the appointment's phone number, then looks up matching acuity_clients rows by phone_normalized first, falling back to secondary_phone_number. On scheduled/rescheduled: applies 'sooner wins' logic — only updates next_future_appointment if the new datetime is earlier than the existing one. On canceled: clears next_future_appointment only if the stored value matches the canceled appointment within a 1-minute tolerance.",
    tags: ["appointment_processors"],
    related: [
      { label: "appointment-webhook", type: "api", targetId: "api-acuity-appointment-webhook" },
      { label: "appointments_look_ahead", type: "edge", targetId: "edge-appointments-look-ahead" },
      { label: "backfill_next_future_appointment", type: "edge", targetId: "edge-backfill-next-future-appointment" },
    ],
  },
  {
    id: "lib-update-sms-barber-success",
    name: "updateSmsBarberSuccess",
    path: "/lib/appointment_processors/update_sms_barber_success.ts",
    summary: "Attributes a new booking to a recent SMS campaign and records the conversion.",
    description: "Called by the Acuity webhook on appointment.scheduled. Looks back across the last 2 ISO weeks of sms_smart_buckets for this barber, finds the most recent bucket where an SMS was sent to the appointment's phone number, and verifies the appointment was created after the SMS was sent. On a match: upserts a barber_nudge_success row (appending client_id, service, price, appointment_date to the arrays) and inserts a notification for the barber. Uses Toronto-timezone ISO week calculation.",
    tags: ["appointment_processors"],
    related: [
      { label: "appointment-webhook", type: "api", targetId: "api-acuity-appointment-webhook" },
      { label: "appointments_look_ahead", type: "edge", targetId: "edge-appointments-look-ahead" },
    ],
  },

  // ── client_sms_from_barber_nudge ────────────────────────────────────────────
  {
    id: "lib-create-smart-buckets",
    name: "createSmartBuckets",
    path: "/lib/client_sms_from_barber_nudge/create_smart_buckets.ts",
    summary: "Creates the weekly sms_smart_buckets row after a barber authorizes their nudge.",
    description: "Called after a barber replies 'yes' (or triggers manually). Guards against duplicate buckets for the same user+ISO week. Determines the send limit based on how many Mondays are in the current month (8 if 5 Mondays, 10 otherwise). Fetches recipients by calling /api/client-messaging/preview-recipients with algorithm=auto-nudge. Builds the clients JSONB array (client_id, phone, full_name, appointment_datecreated_bucket, holiday_cohort) and inserts the bucket with campaign_start (now) and campaign_end (next Wednesday at 23:59). Note: campaign_end controls when client messages stop being sent via send_sms_smart_bucket, not when barber results are sent (results are sent Sunday 10 PM via barber_nudge_update).",
    tags: ["client_sms_from_barber_nudge"],
    related: [
      { label: "barber-nudge (webhook)", type: "api", targetId: "api-barber-nudge-root" },
      { label: "manual-smart-bucket", type: "api", targetId: "api-barber-nudge-manual-smart-bucket" },
      { label: "ClientSMSFromBarberNudge (index)", type: "lib", targetId: "lib-client-sms-index" },
      { label: "clientSmsSelectionAlgorithm_AutoNudge", type: "lib", targetId: "lib-client-sms-selection-autonudge" },
      { label: "send_sms_smart_bucket", type: "edge", targetId: "edge-send-sms-smart-bucket" },
    ],
  },
  {
    id: "lib-client-sms-index",
    name: "ClientSMSFromBarberNudge",
    path: "/lib/client_sms_from_barber_nudge/index.ts",
    summary: "Legacy orchestrator — sends client SMS via Twilio after barber nudge approval.",
    description: "Older flow that directly sends Twilio messages to preview recipients after a barber approves their nudge. Calculates send limit by Mondays-in-month, fetches recipients from /api/client-messaging/preview-recipients, generates an SMS message via /api/client-messaging/generate-sms-template, creates a sms_scheduled_messages row, then loops through recipients sending via Twilio with per-message status callbacks to /api/barber-nudge/sms-status-client. This direct-send flow has been superseded by the smart bucket + pg_cron approach in create_smart_buckets.ts.",
    tags: ["client_sms_from_barber_nudge"],
    related: [
      { label: "createSmartBuckets", type: "lib", targetId: "lib-create-smart-buckets" },
      { label: "sms-status-client", type: "api", targetId: "api-barber-nudge-sms-status-client" },
    ],
  },

  // ── nudge ───────────────────────────────────────────────────────────────────
  {
    id: "lib-holiday-calendar",
    name: "holidayCalendar",
    path: "/lib/nudge/holidayCalendar.ts",
    summary: "Holiday definitions and date-range utilities for seasonal nudge boosting.",
    description: "Single source of truth for all holiday periods used in the nudge scoring system. Exports the HOLIDAYS array (currently Spring Break Season 2025 & 2026) and four utility functions: getActiveHolidayForBoosting (returns the current holiday if today is within its activation window), isDateInHolidayWindow (checks if a date falls within a holiday ± buffer days), getPreviousYearHoliday (finds the same holiday from the prior year for lookback queries), and getHolidayDateRange (returns YYYY-MM-DD start/end strings for Supabase queries). To add a new holiday, append to HOLIDAYS and ensure a prior-year entry exists for lookback.",
    tags: ["nudge"],
    related: [
      { label: "calculateHolidaySensitivity", type: "lib", targetId: "lib-calculate-holiday-sensitivity" },
      { label: "nudge/index", type: "lib", targetId: "lib-nudge-index" },
      { label: "compare-scoring", type: "api", targetId: "api-nudge-compare-scoring" },
      { label: "test-holiday-sensitivity", type: "api", targetId: "api-nudge-test-holiday-sensitivity" },
    ],
  },
  {
    id: "lib-calculate-holiday-sensitivity",
    name: "calculateHolidaySensitivity",
    path: "/lib/nudge/calculateHolidaySensitivity.ts",
    summary: "Boosts client scores by +50 if they historically booked during the same holiday last year.",
    description: "Exports calculateHolidaySensitivityBatch (preferred for multiple clients) and calculateHolidaySensitivity (single client wrapper). For a given holiday, finds the equivalent prior-year entry via getPreviousYearHoliday, computes the ±14-day lookback window via getHolidayDateRange, then runs two Supabase queries against acuity_appointments: one for appointments whose date falls in the window, one for appointments booked (datecreated) during the window. Any client appearing in either set gets boost=HOLIDAY_BOOST_AMOUNT (50) and a holidayCohort tag. Uses a single batch query to avoid N+1.",
    tags: ["nudge"],
    related: [
      { label: "holidayCalendar", type: "lib", targetId: "lib-holiday-calendar" },
      { label: "nudge/index", type: "lib", targetId: "lib-nudge-index" },
      { label: "clientSmsSelectionAlgorithm_AutoNudge", type: "lib", targetId: "lib-client-sms-selection-autonudge" },
      { label: "compare-scoring", type: "api", targetId: "api-nudge-compare-scoring" },
      { label: "test-holiday-sensitivity", type: "api", targetId: "api-nudge-test-holiday-sensitivity" },
    ],
  },
  {
    id: "lib-nudge-index",
    name: "nudge/index",
    path: "/lib/nudge/index.ts",
    summary: "Barrel export for the nudge holiday sensitivity layer.",
    description: "Re-exports everything from holidayCalendar.ts and calculateHolidaySensitivity.ts under a single import path (/lib/nudge). Consumers (like clientSmsSelectionAlgorithm_AutoNudge) import getActiveHolidayForBoosting and calculateHolidaySensitivityBatch from here rather than from the individual files.",
    tags: ["nudge"],
    related: [
      { label: "holidayCalendar", type: "lib", targetId: "lib-holiday-calendar" },
      { label: "calculateHolidaySensitivity", type: "lib", targetId: "lib-calculate-holiday-sensitivity" },
      { label: "clientSmsSelectionAlgorithm_AutoNudge", type: "lib", targetId: "lib-client-sms-selection-autonudge" },
    ],
  },

  // ── booking / availability ──────────────────────────────────────────────────
  {
    id: "lib-availability-orchestrator",
    name: "pullAvailability (orchestrator)",
    path: "/lib/booking/availability/orchestrator.ts",
    summary: "Core availability engine — fetches, deduplicates, and upserts weekly slot data from Acuity and Square.",
    description: "The single entry point for all availability pulls. Accepts a SupabaseClient, userId, and AvailabilityPullOptions (dryRun, forceRefresh, updateMode, weekOffset). Builds a Mon–Sun Toronto-timezone date range for the target week, then iterates over enabled booking source adapters (AcuityAvailabilityAdapter, SquareAvailabilityAdapter — enabled based on the presence of acuity_tokens / square_tokens rows). For each source: checks a 5-minute in-DB cache (availability_daily_summary.fetched_at) unless forceRefresh=true, fetches raw slots from the adapter, deduplicates slots by (user_id, source, calendar_id, slot_date, start_time) keeping the lowest-price or default-service slot, builds daily summaries using interval scheduling to count non-overlapping haircut slots and compute estimated_revenue, then upserts to availability_slots and availability_daily_summary. In updateMode, upserts only slot_count_update and slot_units_update columns (used for tracking slots taken since the nudge was sent). Also derives and persists slot_length_minutes on profiles if not already set, by fetching appointment types from the adapter. Cleanup deletes stale and out-of-range slot/summary rows after a fresh pull. Returns a rich AvailabilityPullResult with per-source stats, hourly buckets, capacity buckets, and errors.",
    tags: ["booking"],
    related: [
      { label: "availability/pull", type: "api", targetId: "api-availability-pull" },
      { label: "update_barber_availability", type: "edge", targetId: "edge-update-barber-availability" },
      { label: "qstash-sms-send", type: "api", targetId: "api-client-messaging-qstash-sms-send" },
      { label: "appointment-webhook", type: "api", targetId: "api-acuity-appointment-webhook" },
    ],
  },
  {
    id: "lib-client-sms-selection-autonudge",
    name: "clientSmsSelectionAlgorithm_AutoNudge",
    path: "/lib/sms/clientSmsSelectionAlgorithm.ts",
    summary: "Scores and selects clients for the weekly AutoNudge SMS send.",
    description: "Core selection algorithm for the weekly barber nudge. Two-phase approach: Phase 1 (strict) — clients with last_appt > 14 days ago, scored by visiting_type with tight overdue windows (consistent: 0–45d, semi-consistent: 0–30d, easy-going: 5–60d, rare: 10–90d). Phase 2 (lenient) — fills remaining slots from clients with last_appt > 7 days ago using a flat 200-point base score with decay after 60 days overdue. Both phases exclude phones that appeared in the current or previous week's smart bucket (exemptPhones). After selection, applies holiday sensitivity boost (+50) via calculateHolidaySensitivityBatch and re-sorts. Final output enforces a 90/10 split: 90% consistent/semi-consistent, 10% other types. SMS cooldown: 14 days.",
    tags: ["sms"],
    related: [
      { label: "nudge/index", type: "lib", targetId: "lib-nudge-index" },
      { label: "calculateHolidaySensitivity", type: "lib", targetId: "lib-calculate-holiday-sensitivity" },
      { label: "holidayCalendar", type: "lib", targetId: "lib-holiday-calendar" },
      { label: "clientSmsSelectionAlgorithm_Campaign", type: "lib", targetId: "lib-client-sms-selection-campaign" },
      { label: "clientSmsSelectionAlgorithm_Mass", type: "lib", targetId: "lib-client-sms-selection-mass" },
    ],
  },
  {
    id: "lib-client-sms-selection-campaign",
    name: "clientSmsSelectionAlgorithm_Campaign",
    path: "/lib/clientSmsSelectionAlgorithm_Campaign.ts",
    summary: "Scores and selects clients for manual holiday/campaign SMS blasts.",
    description: "Selection algorithm for barber-initiated SMS campaigns. Same strict/lenient two-phase scoring as AutoNudge but tuned for campaigns: strict scores get a +500 bonus to ensure they always top the list, SMS cooldown is 7 days (vs 14 for AutoNudge), and deselected phones from the sms_scheduled_messages row are excluded. Returns a CampaignResult with clients (selected), deselectedClients (all eligible non-selected, scored for display), and totalAvailableClients. Does not apply holiday sensitivity boost — campaigns are manually timed.",
    tags: ["sms"],
    related: [
      { label: "clientSmsSelectionAlgorithm_AutoNudge", type: "lib", targetId: "lib-client-sms-selection-autonudge" },
      { label: "clientSmsSelectionAlgorithm_Mass", type: "lib", targetId: "lib-client-sms-selection-mass" },
    ],
  },
  {
    id: "lib-client-sms-selection-mass",
    name: "clientSmsSelectionAlgorithm_Mass",
    path: "/lib/clientSmsSelectionAlgorithm_Mass.ts",
    summary: "Selects clients for mass SMS blasts — sorted alphabetically, no scoring.",
    description: "Simplified selection for mass broadcast campaigns. Fetches all clients with a phone, any appointment history, and sms_subscribed != false. Scores each client with a simple recency formula (MAX_SCORE=240 minus days since last visit, floored at 0) but the final sort is alphabetical by full name — not by score. Respects manually deselected phones from sms_scheduled_messages. Returns the same CampaignResult shape as the Campaign algorithm. Imports AcuityClient and ScoredClient types from clientSmsSelectionAlgorithm_AutoNudge.",
    tags: ["sms"],
    related: [
      { label: "clientSmsSelectionAlgorithm_AutoNudge", type: "lib", targetId: "lib-client-sms-selection-autonudge" },
      { label: "clientSmsSelectionAlgorithm_Campaign", type: "lib", targetId: "lib-client-sms-selection-campaign" },
    ],
  },
];

// ─── Group by category tag (first tag) ───────────────────────────────────────
function groupByCategory(entries: DocEntry[]): Record<string, DocEntry[]> {
  const groups: Record<string, DocEntry[]> = {};
  for (const entry of entries) {
    const category = entry.tags?.[0] ?? "general";
    if (!groups[category]) groups[category] = [];
    groups[category].push(entry);
  }
  return groups;
}

export default function LibDocs({
  highlightedId,
  onJump,
}: {
  highlightedId?: string;
  onJump?: JumpHandler;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return LIB_ENTRIES;
    const q = search.toLowerCase();
    return LIB_ENTRIES.filter(
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
      icon="◈"
      title="Lib"
      subtitle="Utility functions, helpers, and shared logic"
      searchPlaceholder="Search lib files..."
      searchValue={search}
      onSearchChange={setSearch}
    >
      {LIB_ENTRIES.length === 0 ? (
        <p className="text-sm text-[#9ca89a] text-center py-12">No lib files documented yet.</p>
      ) : Object.keys(groups).length === 0 ? (
        <p className="text-sm text-[#9ca89a] text-center py-12">No lib files match your search.</p>
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