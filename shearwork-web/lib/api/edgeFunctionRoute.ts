// lib/api/edgeFunctionRoute.ts
// Shared POST handler for internal routes that just forward to a Supabase edge function
// (analytics summaries, sync triggers).
import { NextResponse } from 'next/server'
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { isInternalRequest, unauthorized } from '@/lib/api/guards'

const SUMMARY_FIELDS = ['targetDate', 'isoWeek'] as const
const SUMMARY_RANGES = [['startDate', 'endDate'], ['isoWeekStart', 'isoWeekEnd']] as const

/** Picks the summary parameters the analytics edge functions understand. */
export function buildSummaryPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = { summaryType: body.summaryType || 'hourly' }
  for (const field of SUMMARY_FIELDS) {
    if (body[field]) payload[field] = body[field]
  }
  for (const [start, end] of SUMMARY_RANGES) {
    if (body[start] && body[end]) {
      payload[start] = body[start]
      payload[end] = body[end]
    }
  }
  return payload
}

export function edgeFunctionRoute(
  functionName: string,
  options: { summaryPayload?: boolean } = {}
) {
  return async function POST(req: Request) {
    if (!isInternalRequest(req)) return unauthorized()

    try {
      const body = options.summaryPayload
        ? buildSummaryPayload(await req.json().catch(() => ({})))
        : undefined

      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.functions.invoke(functionName, body ? { body } : undefined)

      if (error) {
        console.error(`❌ ${functionName} invocation error:`, error)

        if (error instanceof FunctionsHttpError) {
          const status = error.context?.status || 500
          const details = await error.context.text().catch(() => '')
          return NextResponse.json(
            { success: false, error: details || error.message },
            { status }
          )
        }
        if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
          return NextResponse.json(
            { success: false, error: `Function unreachable: ${error.message}` },
            { status: 503 }
          )
        }
        return NextResponse.json(
          { success: false, error: error.message || `Failed to invoke ${functionName}` },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, data })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`💥 ${functionName} route error:`, err)
      return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
  }
}
