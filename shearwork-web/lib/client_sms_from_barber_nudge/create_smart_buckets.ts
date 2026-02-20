import { createClient } from '@supabase/supabase-js'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function getIsoWeek(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayOfWeek = tmp.getUTCDay() || 7 // Mon=1 … Sun=7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getMondaysInMonth(year: number, month: number): number {
  // month is 0-indexed
  let count = 0
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    if (date.getDay() === 1) count++
    date.setDate(date.getDate() + 1)
  }
  return count
}

function getCampaignEnd(from: Date): Date {
  // Always the coming Wednesday (or same day if today is Wednesday) at 23:59:59
  const day = from.getDay() // 0=Sun, 1=Mon, ..., 3=Wed
  const daysUntilWednesday = (3 - day + 7) % 7 || 7
  const end = new Date(from)
  end.setDate(from.getDate() + daysUntilWednesday)
  end.setHours(23, 59, 59, 0)
  return end
}

async function fetchPreviewRecipients(
  user_id: string,
  limit: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const previewResponse = await fetch(
      `${siteUrl}/api/client-messaging/preview-recipients?limit=${limit}&userId=${user_id}&algorithm=auto-nudge`
    )

    if (!previewResponse.ok) {
      console.error('Failed to fetch preview recipients:', previewResponse.statusText)
      return { success: false, error: 'Failed to fetch recipients' }
    }

    const previewData = await previewResponse.json()

    if (!previewData.success || !previewData.phoneNumbers || previewData.phoneNumbers.length === 0) {
      console.log('No clients to message')
      return { success: true, data: null }
    }

    return { success: true, data: previewData }
  } catch (error: any) {
    console.error('Error fetching preview recipients:', error)
    return { success: false, error: error.message }
  }
}

// ----------------------------------------------------------------
// Main
// ----------------------------------------------------------------

export async function createSmartBuckets(
  user_id: string
): Promise<{ success: boolean; bucket_id?: string; error?: string }> {
  const now = new Date()
  const isoWeek = getIsoWeek(now)

  // 1. Duplicate guard
  const { data: existing, error: fetchError } = await supabase
    .from('sms_smart_buckets')
    .select('bucket_id')
    .eq('user_id', user_id)
    .eq('iso_week', isoWeek)
    .maybeSingle()

  if (fetchError) {
    console.error('Error checking for existing bucket:', fetchError)
    return { success: false, error: fetchError.message }
  }

  if (existing) {
    console.log(`[createSmartBuckets] Bucket already exists for user ${user_id} week ${isoWeek} (bucket_id: ${existing.bucket_id}). Skipping.`)
    return { success: true, bucket_id: existing.bucket_id }
  }

  // 2. Determine limit based on how many Mondays are in the current month
  const mondaysInMonth = getMondaysInMonth(now.getFullYear(), now.getMonth())
  const limit = mondaysInMonth === 5 ? 8 : 10

  // 3. Fetch recipients
  const { success, data: previewData, error: previewError } = await fetchPreviewRecipients(user_id, limit)

  if (!success) {
    return { success: false, error: previewError }
  }

  if (!previewData) {
    console.log(`[createSmartBuckets] No recipients found for user ${user_id}. No bucket created.`)
    return { success: true }
  }

  // 4. Shape clients for the jsonb column
  const capitalize = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : ''

  const clients = (previewData.clients as any[]).map((client) => ({
    client_id: client.client_id,
    phone: client.phone_normalized,
    appointment_datecreated_bucket: client.appointment_datecreated_bucket ?? null,
    full_name: `${capitalize(client.first_name)} ${capitalize(client.last_name)}`.trim(),
  }))

  // 5. Insert bucket
  const campaignStart = now
  const campaignEnd = getCampaignEnd(now)

  const { data: inserted, error: insertError } = await supabase
    .from('sms_smart_buckets')
    .insert({
      user_id,
      iso_week: isoWeek,
      status: 'active',
      campaign_start: campaignStart.toISOString(),
      campaign_end: campaignEnd.toISOString(),
      clients,
      total_clients: clients.length,
      messages_failed: [],
    })
    .select('bucket_id')
    .single()

  if (insertError) {
    console.error('Error inserting smart bucket:', insertError)
    return { success: false, error: insertError.message }
  }

  console.log(`[createSmartBuckets] Created bucket ${inserted.bucket_id} for user ${user_id} week ${isoWeek} with ${clients.length} clients.`)
  return { success: true, bucket_id: inserted.bucket_id }
}