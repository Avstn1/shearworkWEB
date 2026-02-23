// supabase/functions/send_sms_smart_bucket/index.ts

// // #region Non-SMS sending version

// // @ts-nocheck
// import "jsr:@supabase/functions-js/edge-runtime.d.ts"
// import { createClient } from 'npm:@supabase/supabase-js@2'

// const supabase = createClient(
//   Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '',
//   Deno.env.get("SERVICE_ROLE_KEY") ?? '',
// )

// // ----------------------------------------------------------------
// // Constants
// // ----------------------------------------------------------------

// const TORONTO_TZ = 'America/Toronto'

// const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// const BATCH_WINDOWS = [
//   { label: 'Morning',   startHour: 8,  startMinute: 0,  endHour: 9,  endMinute: 0  },
//   { label: 'Midday',    startHour: 12, startMinute: 0,  endHour: 13, endMinute: 0  },
//   { label: 'Afternoon', startHour: 16, startMinute: 0,  endHour: 17, endMinute: 0  },
//   { label: 'Night',     startHour: 20, startMinute: 0,  endHour: 21, endMinute: 0  },
// ]

// // Monday Morning fires at 10:30am instead of 8am
// const MONDAY_MORNING_START_HOUR   = 10
// const MONDAY_MORNING_START_MINUTE = 30
// const MONDAY_MORNING_END_HOUR     = 11
// const MONDAY_MORNING_END_MINUTE   = 30

// const CORS_HEADERS = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//   'Access-Control-Allow-Headers': 'Content-Type, Authorization',
// }

// // ----------------------------------------------------------------
// // Helpers
// // ----------------------------------------------------------------

// function torontoNow(): Date {
//   const now = new Date()
//   const parts = new Intl.DateTimeFormat('en-CA', {
//     timeZone: TORONTO_TZ,
//     year: 'numeric', month: '2-digit', day: '2-digit',
//     hour: '2-digit', minute: '2-digit', second: '2-digit',
//     hour12: false,
//   }).formatToParts(now)
//   const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
//   return new Date(
//     parseInt(get('year')),
//     parseInt(get('month')) - 1,
//     parseInt(get('day')),
//     parseInt(get('hour')),
//     parseInt(get('minute')),
//     parseInt(get('second')),
//   )
// }

// function getIsoWeek(date: Date): string {
//   const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
//   const dayOfWeek = tmp.getUTCDay() || 7
//   tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek)
//   const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
//   const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
//   return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
// }

// function toIsoDay(jsDayIndex: number): number {
//   return jsDayIndex === 0 ? 7 : jsDayIndex
// }

// /**
//  * Returns the current batch label if we're inside a window, or null if outside.
//  */
// function getCurrentBatchLabel(dayName: string, hour: number, minute: number): string | null {
//   const totalMinutes = hour * 60 + minute
//   for (const w of BATCH_WINDOWS) {
//     if (w.label === 'Morning') {
//       if (dayName === 'Monday') {
//         const start = MONDAY_MORNING_START_HOUR * 60 + MONDAY_MORNING_START_MINUTE
//         const end   = MONDAY_MORNING_END_HOUR   * 60 + MONDAY_MORNING_END_MINUTE
//         if (totalMinutes >= start && totalMinutes < end) return 'Morning'
//         continue
//       }
//     }
//     const start = w.startHour * 60 + w.startMinute
//     const end   = w.endHour   * 60 + w.endMinute
//     if (totalMinutes >= start && totalMinutes < end) return w.label
//   }
//   return null
// }

// /**
//  * Returns the next available batch label after the current time, or null if no more batches today.
//  * Accounts for Monday Morning being at 10:30am.
//  */
// function getNextBatchLabel(dayName: string, hour: number, minute: number): string | null {
//   const totalMinutes = hour * 60 + minute
//   for (const w of BATCH_WINDOWS) {
//     let windowStart: number
//     if (w.label === 'Morning') {
//       windowStart = dayName === 'Monday'
//         ? MONDAY_MORNING_START_HOUR * 60 + MONDAY_MORNING_START_MINUTE
//         : w.startHour * 60 + w.startMinute
//     } else {
//       windowStart = w.startHour * 60 + w.startMinute
//     }
//     if (totalMinutes < windowStart) return w.label
//   }
//   return null // no more batches today
// }

// /**
//  * Returns true if a given batch label's start time has already passed today.
//  */
// function hasBatchPassedToday(batchLabel: string, dayName: string, hour: number, minute: number): boolean {
//   const totalMinutes = hour * 60 + minute
//   if (batchLabel === 'Morning') {
//     const start = dayName === 'Monday'
//       ? MONDAY_MORNING_START_HOUR * 60 + MONDAY_MORNING_START_MINUTE
//       : BATCH_WINDOWS.find(w => w.label === 'Morning')!.startHour * 60
//     return totalMinutes >= start
//   }
//   const w = BATCH_WINDOWS.find(w => w.label === batchLabel)
//   if (!w) return false
//   return totalMinutes >= w.startHour * 60 + w.startMinute
// }

// // ----------------------------------------------------------------
// // Edge function
// // ----------------------------------------------------------------

// Deno.serve(async (req) => {
//   // Handle CORS preflight
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { status: 204, headers: CORS_HEADERS })
//   }

//   const responseHeaders = { 'Content-Type': 'application/json', ...CORS_HEADERS }

//   try {
//     const utcNow  = new Date()

//     // const toronto = torontoNow() // PRODUCTION: uncomment and remove line below
//     const toronto = (() => {
//       const d = torontoNow()

//       // Manually override date
//       d.setFullYear(2026, 1, 21) 

//       // Manually override time
//       d.setHours(12, 15, 0, 0)

//       return d
//     })()

//     const currentHour     = toronto.getHours()
//     const currentMinute   = toronto.getMinutes()
//     const currentDayIndex = toronto.getDay()
//     const currentDayName  = DAY_NAMES[currentDayIndex]
//     const currentIsoDay   = toIsoDay(currentDayIndex)
//     const currentIsoWeek  = getIsoWeek(toronto)

//     const currentBatch  = getCurrentBatchLabel(currentDayName, currentHour, currentMinute)
//     const nextBatch     = getNextBatchLabel(currentDayName, currentHour, currentMinute)
//     const isManualFire  = !currentBatch  // fired outside a batch window
//     const isInstant     = isManualFire && !nextBatch  // outside window AND no more batches today

//     // Effective batch: what batch are we acting as?
//     // - Inside window     -> use currentBatch
//     // - Between windows   -> use nextBatch (catch-up + upcoming)
//     // - After last window -> instant (send to all eligible regardless of time)
//     const effectiveBatch = currentBatch ?? nextBatch ?? 'INSTANT'

//     console.log('================================================================')
//     console.log('[send_sms_smart_bucket] FIRED')
//     console.log(`  UTC time      : ${utcNow.toISOString()}`)
//     console.log(`  Toronto time  : ${toronto.toLocaleString('en-CA', { hour12: false })}`)
//     console.log(`  Day           : ${currentDayName} (ISO day ${currentIsoDay})`)
//     console.log(`  Time          : ${currentHour}:${String(currentMinute).padStart(2, '0')}`)
//     console.log(`  ISO week      : ${currentIsoWeek}`)
//     console.log(`  Current batch : ${currentBatch ?? 'OUTSIDE WINDOW'}`)
//     console.log(`  Next batch    : ${nextBatch ?? 'NONE — no more batches today'}`)
//     console.log(`  Effective batch: ${effectiveBatch}`)
//     console.log(`  Mode          : ${isInstant ? 'INSTANT (manual, after last batch)' : isManualFire ? 'MANUAL (between batches)' : 'CRON'}`)
//     console.log('================================================================')

//     // ----------------------------------------------------------------
//     // 1. Fetch active buckets for current ISO week
//     // ----------------------------------------------------------------
//     console.log(`\n[Step 1] Fetching active buckets for ${currentIsoWeek}...`)

//     const { data: buckets, error: bucketsError } = await supabase
//       .from('sms_smart_buckets')
//       .select('bucket_id, user_id, clients, iso_week')
//       .eq('iso_week', currentIsoWeek)
//       .eq('status', 'active')

//     if (bucketsError) {
//       console.error('[Step 1] ERROR:', bucketsError)
//       throw bucketsError
//     }

//     console.log(`[Step 1] ${buckets?.length ?? 0} active bucket(s) found`)

//     if (!buckets?.length) {
//       console.log('[Step 1] No active buckets. Exiting.')
//       return new Response(JSON.stringify({ message: 'No active buckets for current week.' }), {
//         headers: responseHeaders, status: 200,
//       })
//     }

//     let totalEligible = 0
//     let totalSkipped  = 0

//     for (const bucket of buckets) {
//       const { bucket_id, user_id, clients } = bucket

//       console.log(`\n[Bucket ${bucket_id}] user: ${user_id} | clients: ${clients?.length ?? 0}`)

//       if (!clients?.length) {
//         console.log(`[Bucket ${bucket_id}] Empty client list. Skipping.`)
//         continue
//       }

//       // ----------------------------------------------------------------
//       // 2. Fetch sms_sent records for this bucket
//       // ----------------------------------------------------------------
//       const { data: smsSentRows, error: smsSentError } = await supabase
//         .from('sms_sent')
//         .select('client_id, created_at')
//         .eq('smart_bucket_id', bucket_id)
//         .eq('is_sent', true)

//       if (smsSentError) {
//         console.error(`[Bucket ${bucket_id}] ERROR fetching sms_sent:`, smsSentError)
//         continue
//       }

//       console.log(`[Bucket ${bucket_id}] Already sent in this bucket: ${smsSentRows?.length ?? 0}`)

//       // client_id -> most recent sent Date
//       const smsSentByClient = new Map<string, Date>()
//       for (const row of smsSentRows || []) {
//         if (!row.client_id) continue
//         const rowDate  = new Date(row.created_at)
//         const existing = smsSentByClient.get(row.client_id)
//         if (!existing || rowDate > existing) smsSentByClient.set(row.client_id, rowDate)
//       }

//       const tenDaysAgo      = new Date(utcNow.getTime() - 10 * 24 * 60 * 60 * 1000)
//       const eligibleClients: typeof clients = []

//       // ----------------------------------------------------------------
//       // 3-6. Evaluate each client
//       // ----------------------------------------------------------------
//       for (const client of clients) {
//         const { client_id, appointment_datecreated_bucket } = client

//         if (!appointment_datecreated_bucket) { totalSkipped++; continue }

//         const [dayPart, timePart] = appointment_datecreated_bucket.split('|')

//         // Dedup: skip if messaged within last 10 days
//         const lastSentAt = smsSentByClient.get(client_id)
//         if (lastSentAt && lastSentAt > tenDaysAgo) { totalSkipped++; continue }

//         // Day check: client's preferred day must have arrived this week
//         if (dayPart !== 'Any-day') {
//           const clientIsoDay = toIsoDay(DAY_NAMES.indexOf(dayPart))
//           if (clientIsoDay > currentIsoDay) {
//             // Day hasn't arrived yet this week — skip regardless of mode
//             totalSkipped++; continue
//           }
//           // Day is today or already passed — proceed to time check
//         }

//         // Time check
//         if (timePart === 'Any-time') {
//           // Any-time: always eligible as long as day has arrived
//           eligibleClients.push(client); totalEligible++; continue
//         }

//         if (isInstant) {
//           // After last batch of the day — send instantly to everyone whose day arrived
//           eligibleClients.push(client); totalEligible++; continue
//         }

//         // Check if the preferred batch has already passed today
//         const batchPassed = hasBatchPassedToday(timePart, currentDayName, currentHour, currentMinute)

//         if (timePart === effectiveBatch) {
//           // Preferred batch matches current or next batch — eligible
//           eligibleClients.push(client); totalEligible++
//         } else if (batchPassed) {
//           // Preferred batch already passed today — catch up at next available batch
//           eligibleClients.push(client); totalEligible++
//         } else {
//           // Preferred batch hasn't fired yet today — wait for it
//           totalSkipped++
//         }
//       }

//       // ----------------------------------------------------------------
//       // 7. Log final eligible list
//       // ----------------------------------------------------------------
//       console.log(`[Bucket ${bucket_id}] Mode: ${effectiveBatch} — eligible: ${eligibleClients.length} | skipped: ${clients.length - eligibleClients.length}`)

//       if (eligibleClients.length === 0) {
//         console.log(`[Bucket ${bucket_id}] No eligible clients.`)
//         continue
//       }

//       console.log(`[Bucket ${bucket_id}] Clients that WOULD be messaged:`)
//       for (const client of eligibleClients) {
//         console.log(`  [PLACEHOLDER - WOULD MESSAGE] ${client.full_name} | ${client.phone} | bucket: ${client.appointment_datecreated_bucket}`)
//         // Call Twilio here with smart_bucket_id as message_id
//         // Upsert into sms_sent (smart_bucket_id, client_id, phone_normalized, is_sent, purpose)
//       }
//     }

//     // ----------------------------------------------------------------
//     // Summary
//     // ----------------------------------------------------------------
//     console.log('\n================================================================')
//     console.log('[send_sms_smart_bucket] RUN COMPLETE')
//     console.log(`  ISO week       : ${currentIsoWeek}`)
//     console.log(`  Day            : ${currentDayName}`)
//     console.log(`  Effective batch: ${effectiveBatch}`)
//     console.log(`  Mode           : ${isInstant ? 'INSTANT' : isManualFire ? 'MANUAL' : 'CRON'}`)
//     console.log(`  Toronto time   : ${toronto.toLocaleString('en-CA', { hour12: false })}`)
//     console.log(`  Total eligible : ${totalEligible}`)
//     console.log(`  Total skipped  : ${totalSkipped}`)
//     console.log('================================================================')

//     return new Response(JSON.stringify({
//       message: 'Batch run complete (dry run — no messages sent)',
//       isoWeek: currentIsoWeek,
//       day: currentDayName,
//       effectiveBatch,
//       mode: isInstant ? 'INSTANT' : isManualFire ? 'MANUAL' : 'CRON',
//       torontoTime: toronto.toLocaleString('en-CA', { hour12: false }),
//       totalEligible,
//       totalSkipped,
//     }), {
//       headers: responseHeaders, status: 200,
//     })

//   } catch (err: unknown) {
//     console.error('[send_sms_smart_bucket] FATAL ERROR:', err)
//     const errorMessage = err instanceof Error ? err.message : String(err)
//     return new Response(JSON.stringify({ error: errorMessage }), {
//       status: 500,
//       headers: responseHeaders,
//     })
//   }
// })

// // #endregion

// #region SMS Sending Version
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import twilio from 'npm:twilio@4'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '',
  Deno.env.get("SERVICE_ROLE_KEY") ?? '',
)

const twilioClient = twilio(
  Deno.env.get("TWILIO_ACCOUNT_SID") ?? '',
  Deno.env.get("TWILIO_AUTH_TOKEN") ?? '',
)

const MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") ?? ''
const SITE_URL              = Deno.env.get("SITE_URL") ?? ''

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const TORONTO_TZ = 'America/Toronto'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const BATCH_WINDOWS = [
  { label: 'Morning',   startHour: 8,  startMinute: 0,  endHour: 9,  endMinute: 0  },
  { label: 'Midday',    startHour: 12, startMinute: 0,  endHour: 13, endMinute: 0  },
  { label: 'Afternoon', startHour: 16, startMinute: 0,  endHour: 17, endMinute: 0  },
  { label: 'Night',     startHour: 20, startMinute: 0,  endHour: 21, endMinute: 0  },
]

const MONDAY_MORNING_START_HOUR   = 10
const MONDAY_MORNING_START_MINUTE = 30
const MONDAY_MORNING_END_HOUR     = 11
const MONDAY_MORNING_END_MINUTE   = 30

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ----------------------------------------------------------------
// Time helpers
// ----------------------------------------------------------------

function torontoNow(): Date {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
  return new Date(
    parseInt(get('year')),
    parseInt(get('month')) - 1,
    parseInt(get('day')),
    parseInt(get('hour')),
    parseInt(get('minute')),
    parseInt(get('second')),
  )
}

function getIsoWeek(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayOfWeek = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function toIsoDay(jsDayIndex: number): number {
  return jsDayIndex === 0 ? 7 : jsDayIndex
}

function getCurrentBatchLabel(dayName: string, hour: number, minute: number): string | null {
  const totalMinutes = hour * 60 + minute
  for (const w of BATCH_WINDOWS) {
    if (w.label === 'Morning') {
      if (dayName === 'Monday') {
        const start = MONDAY_MORNING_START_HOUR * 60 + MONDAY_MORNING_START_MINUTE
        const end   = MONDAY_MORNING_END_HOUR   * 60 + MONDAY_MORNING_END_MINUTE
        if (totalMinutes >= start && totalMinutes < end) return 'Morning'
        continue
      }
    }
    const start = w.startHour * 60 + w.startMinute
    const end   = w.endHour   * 60 + w.endMinute
    if (totalMinutes >= start && totalMinutes < end) return w.label
  }
  return null
}

function getNextBatchLabel(dayName: string, hour: number, minute: number): string | null {
  const totalMinutes = hour * 60 + minute
  for (const w of BATCH_WINDOWS) {
    const windowStart = w.label === 'Morning' && dayName === 'Monday'
      ? MONDAY_MORNING_START_HOUR * 60 + MONDAY_MORNING_START_MINUTE
      : w.startHour * 60 + w.startMinute
    if (totalMinutes < windowStart) return w.label
  }
  return null
}

function hasBatchPassedToday(batchLabel: string, dayName: string, hour: number, minute: number): boolean {
  const totalMinutes = hour * 60 + minute
  if (batchLabel === 'Morning') {
    const start = dayName === 'Monday'
      ? MONDAY_MORNING_START_HOUR * 60 + MONDAY_MORNING_START_MINUTE
      : BATCH_WINDOWS.find(w => w.label === 'Morning')!.startHour * 60
    return totalMinutes >= start
  }
  const w = BATCH_WINDOWS.find(w => w.label === batchLabel)
  if (!w) return false
  return totalMinutes >= w.startHour * 60 + w.startMinute
}

// ----------------------------------------------------------------
// SMS helpers
// ----------------------------------------------------------------

function addTokenToBookingLink(message: string, token: string, username: string): string {
  const pattern = `${SITE_URL}book?profile=${username}`
  return message.replace(pattern, `${SITE_URL}book?profile=${username}&t=${token}`)
}

async function generateSMSMessage(profile: {
  full_name: string
  email: string
  phone: string
  username: string
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const bookingLink = `${SITE_URL}book?profile=${profile.username}`
    const response = await fetch(`${SITE_URL}/api/client-messaging/generate-sms-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Generate a professional barbershop marketing SMS message',
        profile: {
          full_name: profile.full_name ?? '',
          email: profile.email ?? '',
          phone: profile.phone ?? '',
          booking_link: bookingLink,
        },
      }),
    })

    if (!response.ok) {
      console.error('Failed to generate SMS template:', response.statusText)
      return { success: false, error: 'Failed to generate message template' }
    }

    const data = await response.json()
    const message = data.message || data.template

    if (!message) {
      return { success: false, error: 'No message template generated' }
    }

    return { success: true, message }
  } catch (error: any) {
    console.error('Error generating SMS message:', error)
    return { success: false, error: error.message }
  }
}

// ----------------------------------------------------------------
// Edge function
// ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const responseHeaders = { 'Content-Type': 'application/json', ...CORS_HEADERS }

  try {
    const utcNow  = new Date()
    // const toronto = torontoNow() // PRODUCTION: uncomment and remove line below
    const toronto = (() => { const d = torontoNow(); d.setHours(12, 15, 0, 0); return d })() // CHANGE THIS LATER

    const currentHour     = toronto.getHours()
    const currentMinute   = toronto.getMinutes()
    const currentDayIndex = toronto.getDay()
    const currentDayName  = DAY_NAMES[currentDayIndex]
    const currentIsoDay   = toIsoDay(currentDayIndex)
    const currentIsoWeek  = getIsoWeek(toronto)

    const currentBatch  = getCurrentBatchLabel(currentDayName, currentHour, currentMinute)
    const nextBatch     = getNextBatchLabel(currentDayName, currentHour, currentMinute)
    const isManualFire  = !currentBatch
    const isInstant     = isManualFire && !nextBatch
    const effectiveBatch = currentBatch ?? nextBatch ?? 'INSTANT'

    console.log('================================================================')
    console.log('[send_sms_smart_bucket] FIRED')
    console.log(`  UTC time       : ${utcNow.toISOString()}`)
    console.log(`  Toronto time   : ${toronto.toLocaleString('en-CA', { hour12: false })}`)
    console.log(`  Day            : ${currentDayName} (ISO day ${currentIsoDay})`)
    console.log(`  Time           : ${currentHour}:${String(currentMinute).padStart(2, '0')}`)
    console.log(`  ISO week       : ${currentIsoWeek}`)
    console.log(`  Current batch  : ${currentBatch ?? 'OUTSIDE WINDOW'}`)
    console.log(`  Next batch     : ${nextBatch ?? 'NONE — no more batches today'}`)
    console.log(`  Effective batch: ${effectiveBatch}`)
    console.log(`  Mode           : ${isInstant ? 'INSTANT' : isManualFire ? 'MANUAL' : 'CRON'}`)
    console.log('================================================================')

    // ----------------------------------------------------------------
    // 1. Fetch active buckets for current ISO week
    // ----------------------------------------------------------------
    console.log(`\n[Step 1] Fetching active buckets for ${currentIsoWeek}...`)

    const { data: buckets, error: bucketsError } = await supabase
      .from('sms_smart_buckets')
      .select('bucket_id, user_id, clients, iso_week')
      .eq('iso_week', currentIsoWeek)
      .eq('status', 'active')

    if (bucketsError) {
      console.error('[Step 1] ERROR:', bucketsError)
      throw bucketsError
    }

    console.log(`[Step 1] ${buckets?.length ?? 0} active bucket(s) found`)

    if (!buckets?.length) {
      console.log('[Step 1] No active buckets. Exiting.')
      return new Response(JSON.stringify({ message: 'No active buckets for current week.' }), {
        headers: responseHeaders, status: 200,
      })
    }

    let totalEligible = 0
    let totalSkipped  = 0
    let totalSent     = 0
    let totalFailed   = 0

    for (const bucket of buckets) {
      const { bucket_id, user_id, clients } = bucket

      console.log(`\n[Bucket ${bucket_id}] user: ${user_id} | clients: ${clients?.length ?? 0}`)

      if (!clients?.length) {
        console.log(`[Bucket ${bucket_id}] Empty client list. Skipping.`)
        continue
      }

      // ----------------------------------------------------------------
      // 2. Fetch sms_sent records for this bucket
      // ----------------------------------------------------------------
      const { data: smsSentRows, error: smsSentError } = await supabase
        .from('sms_sent')
        .select('client_id, created_at')
        .eq('smart_bucket_id', bucket_id)
        .eq('is_sent', true)

      if (smsSentError) {
        console.error(`[Bucket ${bucket_id}] ERROR fetching sms_sent:`, smsSentError)
        continue
      }

      console.log(`[Bucket ${bucket_id}] Already sent in this bucket: ${smsSentRows?.length ?? 0}`)

      const smsSentByClient = new Map<string, Date>()
      for (const row of smsSentRows || []) {
        if (!row.client_id) continue
        const rowDate  = new Date(row.created_at)
        const existing = smsSentByClient.get(row.client_id)
        if (!existing || rowDate > existing) smsSentByClient.set(row.client_id, rowDate)
      }

      const tenDaysAgo      = new Date(utcNow.getTime() - 10 * 24 * 60 * 60 * 1000)
      const eligibleClients: typeof clients = []

      // ----------------------------------------------------------------
      // 3-6. Evaluate each client
      // ----------------------------------------------------------------
      for (const client of clients) {
        const { client_id, appointment_datecreated_bucket } = client

        if (!appointment_datecreated_bucket) { totalSkipped++; continue }

        const [dayPart, timePart] = appointment_datecreated_bucket.split('|')

        const lastSentAt = smsSentByClient.get(client_id)
        if (lastSentAt && lastSentAt > tenDaysAgo) { totalSkipped++; continue }

        if (dayPart !== 'Any-day') {
          const clientIsoDay = toIsoDay(DAY_NAMES.indexOf(dayPart))
          if (clientIsoDay > currentIsoDay) { totalSkipped++; continue }
        }

        if (timePart === 'Any-time') {
          eligibleClients.push(client); totalEligible++; continue
        }

        if (isInstant) {
          eligibleClients.push(client); totalEligible++; continue
        }

        const batchPassed = hasBatchPassedToday(timePart, currentDayName, currentHour, currentMinute)

        if (timePart === effectiveBatch || batchPassed) {
          eligibleClients.push(client); totalEligible++
        } else {
          totalSkipped++
        }
      }

      console.log(`[Bucket ${bucket_id}] Eligible: ${eligibleClients.length} | Skipped: ${clients.length - eligibleClients.length}`)

      if (eligibleClients.length === 0) {
        console.log(`[Bucket ${bucket_id}] No eligible clients.`)
        continue
      }

      // ----------------------------------------------------------------
      // 3. Fetch barber profile (one query per bucket)
      // ----------------------------------------------------------------
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email, phone, username')
        .eq('user_id', user_id)
        .single()

      if (profileError || !profile) {
        console.error(`[Bucket ${bucket_id}] ERROR fetching profile:`, profileError)
        continue
      }

      console.log(`[Bucket ${bucket_id}] Barber: ${profile.full_name} (@${profile.username})`)

      // ----------------------------------------------------------------
      // 4. Insert barber_nudge_success row upfront
      // ----------------------------------------------------------------
      const { error: nudgeInsertError } = await supabase
        .from('barber_nudge_success')
        .insert({
          user_id,
          iso_week_number: currentIsoWeek,
          messages_delivered: 0,
          clicked_link: 0,
          client_ids: [],
          services: [],
          appointment_dates: [],
        })

      if (nudgeInsertError) {
        console.error(`[Bucket ${bucket_id}] ERROR inserting barber_nudge_success:`, nudgeInsertError)
        // Non-fatal — continue with messaging
      }

      // ----------------------------------------------------------------
      // 5. Generate SMS message (once per bucket)
      // ----------------------------------------------------------------
      const messageResult = await generateSMSMessage(profile)

      if (!messageResult.success || !messageResult.message) {
        console.error(`[Bucket ${bucket_id}] ERROR generating SMS message:`, messageResult.error)
        continue
      }

      const baseMessage = messageResult.message
      console.log(`[Bucket ${bucket_id}] SMS message generated successfully`)

      // ----------------------------------------------------------------
      // 6. Send messages to eligible clients
      // ----------------------------------------------------------------
      const statusCallbackUrl = `${SITE_URL}/api/barber-nudge/sms-status-client`
      const failedPhones: string[] = []

      for (const client of eligibleClients) {
        const { client_id, phone, full_name, link_token } = client

        if (!phone) {
          console.log(`[Bucket ${bucket_id}] Skipping ${full_name} — no phone`)
          continue
        }

        const messageWithToken = link_token
          ? addTokenToBookingLink(baseMessage, link_token, profile.username)
          : baseMessage

        try {
          const callbackUrl = new URL(statusCallbackUrl)
          callbackUrl.searchParams.set('user_id', user_id)
          callbackUrl.searchParams.set('client_id', client_id ?? '')
          callbackUrl.searchParams.set('message', messageWithToken)
          callbackUrl.searchParams.set('message_id', bucket_id)

          const twilioMessage = await twilioClient.messages.create({
            body: `${messageWithToken}\n\nReply STOP to unsubscribe.`,
            messagingServiceSid: MESSAGING_SERVICE_SID,
            to: phone,
            statusCallback: callbackUrl.toString(),
          })

          console.log(`[Bucket ${bucket_id}] Sent to ${full_name} (${phone}) — SID: ${twilioMessage.sid}`)

          // Insert sms_sent record
          await supabase.from('sms_sent').insert({
            user_id,
            smart_bucket_id: bucket_id,
            client_id: client_id ?? null,
            phone_normalized: phone,
            is_sent: true,
            purpose: 'auto-nudge',
            message: messageWithToken,
          })

          totalSent++
        } catch (err: any) {
          console.error(`[Bucket ${bucket_id}] FAILED to send to ${full_name} (${phone}):`, err.message)

          // Insert failed sms_sent record
          await supabase.from('sms_sent').insert({
            user_id,
            smart_bucket_id: bucket_id,
            client_id: client_id ?? null,
            phone_normalized: phone,
            is_sent: false,
            purpose: 'auto-nudge',
            message: messageWithToken,
            reason: err.message,
          })

          failedPhones.push(phone)
          totalFailed++
        }
      }

      // ----------------------------------------------------------------
      // 7. Update messages_failed on the bucket if any failed
      // ----------------------------------------------------------------
      if (failedPhones.length > 0) {
        const { data: currentBucketData } = await supabase
          .from('sms_smart_buckets')
          .select('messages_failed')
          .eq('bucket_id', bucket_id)
          .single()

        const existing = currentBucketData?.messages_failed ?? []
        await supabase
          .from('sms_smart_buckets')
          .update({ messages_failed: [...existing, ...failedPhones] })
          .eq('bucket_id', bucket_id)

        console.log(`[Bucket ${bucket_id}] Updated messages_failed with ${failedPhones.length} phone(s)`)
      }

      console.log(`[Bucket ${bucket_id}] Done — sent: ${eligibleClients.length - failedPhones.length} | failed: ${failedPhones.length}`)
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------
    console.log('\n================================================================')
    console.log('[send_sms_smart_bucket] RUN COMPLETE')
    console.log(`  ISO week       : ${currentIsoWeek}`)
    console.log(`  Day            : ${currentDayName}`)
    console.log(`  Effective batch: ${effectiveBatch}`)
    console.log(`  Mode           : ${isInstant ? 'INSTANT' : isManualFire ? 'MANUAL' : 'CRON'}`)
    console.log(`  Toronto time   : ${toronto.toLocaleString('en-CA', { hour12: false })}`)
    console.log(`  Total eligible : ${totalEligible}`)
    console.log(`  Total skipped  : ${totalSkipped}`)
    console.log(`  Total sent     : ${totalSent}`)
    console.log(`  Total failed   : ${totalFailed}`)
    console.log('================================================================')

    return new Response(JSON.stringify({
      message: 'Batch run complete',
      isoWeek: currentIsoWeek,
      day: currentDayName,
      effectiveBatch,
      mode: isInstant ? 'INSTANT' : isManualFire ? 'MANUAL' : 'CRON',
      torontoTime: toronto.toLocaleString('en-CA', { hour12: false }),
      totalEligible,
      totalSkipped,
      totalSent,
      totalFailed,
    }), {
      headers: responseHeaders, status: 200,
    })

  } catch (err: unknown) {
    console.error('[send_sms_smart_bucket] FATAL ERROR:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: responseHeaders,
    })
  }
})

// #endregion
