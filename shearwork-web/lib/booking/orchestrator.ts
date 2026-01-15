// lib/booking/orchestrator.ts

import { SupabaseClient } from '@supabase/supabase-js'
import {
  PullOptions,
  PullResult,
  DateRange,
  Month,
  MONTHS,
  AggregationResult,
  NormalizedAppointment,
} from './types'
import { getBookingAdapter } from './adapters'
import { SquareAdapter } from './adapters/square'
import { ClientProcessor } from './processors/clients'
import { AppointmentProcessor } from './processors/appointments'
import { SquareClientProcessor } from './processors/squareClients'
import { SquareAppointmentProcessor } from './processors/squareAppointments'
import { runAggregations } from './processors/aggregations'
import { SquarePaymentRecord } from '@/lib/square/normalize'

// ======================== DATE RANGE HELPERS ========================

/**
 * Converts PullOptions to a DateRange for fetching appointments.
 */
export function pullOptionsToDateRange(options: PullOptions): DateRange {
  const { granularity, year, quarter, month, weekNumber, day } = options

  switch (granularity) {
    case 'year': {
      return {
        startISO: `${year}-01-01`,
        endISO: `${year}-12-31`,
      }
    }

    case 'quarter': {
      const quarterMap: Record<string, { start: string; end: string }> = {
        Q1: { start: `${year}-01-01`, end: `${year}-03-31` },
        Q2: { start: `${year}-04-01`, end: `${year}-06-30` },
        Q3: { start: `${year}-07-01`, end: `${year}-09-30` },
        Q4: { start: `${year}-10-01`, end: `${year}-12-31` },
      }
      const q = quarterMap[quarter || 'Q1']
      return { startISO: q.start, endISO: q.end }
    }

    case 'month': {
      const monthIndex = MONTHS.indexOf(month as Month)
      if (monthIndex === -1) {
        throw new Error(`Invalid month: ${month}`)
      }
      const startDate = new Date(year, monthIndex, 1)
      const endDate = new Date(year, monthIndex + 1, 0) // Last day of month
      return {
        startISO: formatDate(startDate),
        endISO: formatDate(endDate),
      }
    }

    case 'week': {
      if (!month || !weekNumber) {
        throw new Error('Week granularity requires month and weekNumber')
      }
      const monthIndex = MONTHS.indexOf(month as Month)
      if (monthIndex === -1) {
        throw new Error(`Invalid month: ${month}`)
      }
      // Find the first Monday of the month
      const firstOfMonth = new Date(year, monthIndex, 1)
      const firstMonday = getFirstMondayOfMonth(firstOfMonth)
      
      // Calculate the start of the requested week
      const weekStart = new Date(firstMonday)
      weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
      
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      return {
        startISO: formatDate(weekStart),
        endISO: formatDate(weekEnd),
      }
    }

    case 'day': {
      if (!month || !day) {
        throw new Error('Day granularity requires month and day')
      }
      const monthIndex = MONTHS.indexOf(month as Month)
      if (monthIndex === -1) {
        throw new Error(`Invalid month: ${month}`)
      }
      const date = new Date(year, monthIndex, day)
      const dateStr = formatDate(date)
      return {
        startISO: dateStr,
        endISO: dateStr,
      }
    }

    default:
      throw new Error(`Unknown granularity: ${granularity}`)
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getFirstMondayOfMonth(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const dayOfWeek = first.getDay()
  // If Sunday (0), add 1 day. Otherwise, add days until Monday.
  const daysToAdd = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek
  const monday = new Date(first)
  monday.setDate(first.getDate() + daysToAdd)
  return monday
}

// ======================== ORCHESTRATOR OPTIONS ========================

export interface OrchestratorOptions {
  /** Table prefix for testing (e.g., 'test_' uses test tables) */
  tablePrefix?: string
  /** Skip aggregations (useful for testing) */
  skipAggregations?: boolean
  /** Dry run - don't write to database */
  dryRun?: boolean
}

// ======================== MAIN ORCHESTRATOR ========================

/**
 * Orchestrates the entire pull flow:
 * 1. Fetch appointments from booking software
 * 2. Resolve clients (identity matching)
 * 3. Upsert clients to database
 * 4. Upsert appointments to database
 * 5. Run aggregations (daily, weekly, monthly)
 */
export async function pull(
  supabase: SupabaseClient,
  userId: string,
  options: PullOptions,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<PullResult> {
  const { tablePrefix = '', skipAggregations = false, dryRun = false } = orchestratorOptions
  const errors: string[] = []
  const aggregations: AggregationResult[] = []
  const fetchedAt = new Date().toISOString()

  const sources: PullResult['sources'] = {}
  const combinedClients = {
    totalProcessed: 0,
    newClients: 0,
    existingClients: 0,
    mergedClients: 0,
  }
  const combinedAppointments = {
    totalProcessed: 0,
    inserted: 0,
    updated: 0,
    skippedNoClient: 0,
    revenuePreserved: 0,
  }

  let appointmentCount = 0

  const dateRange = pullOptionsToDateRange(options)

  // ======================== ACUITY PIPELINE ========================
  const { data: acuityToken } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (acuityToken?.access_token) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('calendar')
        .eq('user_id', userId)
        .single()

      if (profileError || !profile) {
        throw new Error(`No profile found for user: ${profileError?.message || 'unknown error'}`)
      }

      const acuityAdapter = getBookingAdapter('acuity')
      const acuityAccessToken = await acuityAdapter.ensureValidToken(supabase, userId)
      const calendarId = await acuityAdapter.getCalendarId(acuityAccessToken, supabase, userId)
      const appointments = await acuityAdapter.fetchAppointments(acuityAccessToken, calendarId, dateRange)

      const clientProcessor = new ClientProcessor(supabase, userId, { tablePrefix })
      const clientResolution = await clientProcessor.resolve(appointments)

      let clientResult = {
        totalProcessed: clientResolution.clients.size,
        newClients: clientResolution.newClientIds.size,
        existingClients: clientResolution.clients.size - clientResolution.newClientIds.size,
        mergedClients: 0,
      }

      if (!dryRun) {
        clientResult = await clientProcessor.upsert()
      }

      const appointmentProcessor = new AppointmentProcessor(supabase, userId, { tablePrefix })
      appointmentProcessor.process(appointments, clientResolution)

      let appointmentResult = {
        totalProcessed: appointmentProcessor.getUpsertPayload().length,
        inserted: 0,
        updated: 0,
        skippedNoClient: appointmentProcessor.getSkippedCount(),
        revenuePreserved: 0,
      }

      if (!dryRun) {
        appointmentResult = await appointmentProcessor.upsert()
      }

      sources.acuity = {
        appointmentCount: appointments.length,
        clients: clientResult,
        appointments: {
          totalProcessed: appointmentResult.totalProcessed,
          inserted: appointmentResult.inserted,
          updated: appointmentResult.updated,
          skipped: appointmentResult.skippedNoClient,
        },
      }

      appointmentCount += appointments.length
      combinedClients.totalProcessed += clientResult.totalProcessed
      combinedClients.newClients += clientResult.newClients
      combinedClients.existingClients += clientResult.existingClients
      combinedClients.mergedClients += clientResult.mergedClients
      combinedAppointments.totalProcessed += appointmentResult.totalProcessed
      combinedAppointments.inserted += appointmentResult.inserted
      combinedAppointments.updated += appointmentResult.updated
      combinedAppointments.skippedNoClient += appointmentResult.skippedNoClient
      combinedAppointments.revenuePreserved += appointmentResult.revenuePreserved
    } catch (err) {
      errors.push(`Acuity: ${formatErrorMessage(err)}`)
    }
  }

  // ======================== SQUARE PIPELINE ========================
  const { data: squareToken } = await supabase
    .from('square_tokens')
    .select('access_token, merchant_id')
    .eq('user_id', userId)
    .maybeSingle()

  const shouldRunSquare = Boolean(squareToken?.access_token) && tablePrefix === ''

  if (shouldRunSquare) {
    try {
      const squareAdapter = new SquareAdapter()
      const squareAccessToken = await squareAdapter.ensureValidToken(supabase, userId)
      const locationId = await squareAdapter.getCalendarId(squareAccessToken, supabase, userId)
      const locations = await squareAdapter.fetchLocations(squareAccessToken)

      const squareAppointments = await squareAdapter.fetchAppointmentsForLocations(
        squareAccessToken,
        locationId,
        dateRange,
        locations
      )

      const squarePayments = await squareAdapter.fetchPayments(
        squareAccessToken,
        locationId,
        dateRange,
        locations
      )

      const storedPayments = await loadStoredSquarePayments(
        supabase,
        userId,
        dateRange
      )

      const paymentsForMatching = mergeSquarePayments(
        squarePayments,
        storedPayments
      )

      const { appointments: appointmentsWithPayments } = matchSquarePaymentsToAppointments(
        squareAppointments,
        paymentsForMatching
      )

      if (!dryRun) {
        await upsertSquarePayments(
          supabase,
          userId,
          squareToken?.merchant_id || 'unknown',
          squarePayments
        )
      }

      const squareClientProcessor = new SquareClientProcessor(supabase, userId, {
        tablePrefix,
        merchantId: squareToken?.merchant_id || 'unknown',
      })
      const squareClientResolution = await squareClientProcessor.resolve(appointmentsWithPayments)

      let squareClientResult = {
        totalProcessed: squareClientResolution.clients.size,
        newClients: squareClientResolution.newClientIds.size,
        existingClients: squareClientResolution.clients.size - squareClientResolution.newClientIds.size,
        mergedClients: 0,
      }

      if (!dryRun) {
        squareClientResult = await squareClientProcessor.upsert()
      }

      const squareAppointmentProcessor = new SquareAppointmentProcessor(supabase, userId, {
        tablePrefix,
        merchantId: squareToken?.merchant_id || 'unknown',
      })

      squareAppointmentProcessor.process(appointmentsWithPayments, squareClientResolution)

      let squareAppointmentResult = {
        totalProcessed: squareAppointmentProcessor.getUpsertPayload().length,
        inserted: 0,
        updated: 0,
        skippedNoClient: squareAppointmentProcessor.getSkippedCount(),
        revenuePreserved: 0,
      }

      if (!dryRun) {
        squareAppointmentResult = await squareAppointmentProcessor.upsert()
      }

      sources.square = {
        appointmentCount: appointmentsWithPayments.length,
        clients: squareClientResult,
        appointments: {
          totalProcessed: squareAppointmentResult.totalProcessed,
          inserted: squareAppointmentResult.inserted,
          updated: squareAppointmentResult.updated,
          skipped: squareAppointmentResult.skippedNoClient,
        },
      }

      appointmentCount += appointmentsWithPayments.length
      combinedClients.totalProcessed += squareClientResult.totalProcessed
      combinedClients.newClients += squareClientResult.newClients
      combinedClients.existingClients += squareClientResult.existingClients
      combinedClients.mergedClients += squareClientResult.mergedClients
      combinedAppointments.totalProcessed += squareAppointmentResult.totalProcessed
      combinedAppointments.inserted += squareAppointmentResult.inserted
      combinedAppointments.updated += squareAppointmentResult.updated
      combinedAppointments.skippedNoClient += squareAppointmentResult.skippedNoClient
      combinedAppointments.revenuePreserved += squareAppointmentResult.revenuePreserved
    } catch (err) {
      errors.push(`Square: ${formatErrorMessage(err)}`)
    }
  }

  const hasSources = Object.keys(sources).length > 0

  if (!hasSources) {
    errors.push('No booking sources connected')
  }

  if (!skipAggregations && hasSources) {
    const aggregationResults = await runAggregations(
      { supabase, userId, options },
      { tablePrefix, skipAggregations, dryRun }
    )
    aggregations.push(...aggregationResults)
  }

  return {
    success: errors.length === 0,
    fetchedAt,
    appointmentCount,
    clients: combinedClients,
    appointments: {
      totalProcessed: combinedAppointments.totalProcessed,
      inserted: combinedAppointments.inserted,
      updated: combinedAppointments.updated,
      skipped: combinedAppointments.skippedNoClient,
    },
    aggregations,
    errors: errors.length > 0 ? errors : undefined,
    sources,
  }
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error)
  } catch (err) {
    return String(error)
  }
}

interface OrderPaymentTotals {
  total: number
  tip: number
  paymentIds: string[]
}

function buildPaymentTotalsByOrder(
  payments: SquarePaymentRecord[]
): Map<string, OrderPaymentTotals> {
  const totals = new Map<string, OrderPaymentTotals>()

  for (const payment of payments) {
    if (!payment.orderId) continue

    const current = totals.get(payment.orderId) || { total: 0, tip: 0, paymentIds: [] }
    current.total += payment.amountTotal
    current.tip += payment.tipAmount
    current.paymentIds.push(payment.paymentId)
    totals.set(payment.orderId, current)
  }

  return totals
}

function mergeSquarePayments(
  primary: SquarePaymentRecord[],
  secondary: SquarePaymentRecord[]
): SquarePaymentRecord[] {
  const map = new Map<string, SquarePaymentRecord>()
  const merged: SquarePaymentRecord[] = []

  for (const payment of secondary) {
    if (!payment.paymentId) continue
    map.set(payment.paymentId, payment)
  }

  for (const payment of primary) {
    if (!payment.paymentId) continue
    map.set(payment.paymentId, payment)
  }

  for (const payment of map.values()) {
    merged.push(payment)
  }

  return merged
}

async function loadStoredSquarePayments(
  supabase: SupabaseClient,
  userId: string,
  dateRange: DateRange
): Promise<SquarePaymentRecord[]> {
  const { data, error } = await supabase
    .from('square_payments')
    .select(
      'payment_id, location_id, order_id, customer_id, appointment_date, currency, amount_total, tip_amount, processing_fee, net_amount, status, source_type, receipt_number, receipt_url, card_brand, card_last4, created_at, updated_at'
    )
    .eq('user_id', userId)
    .eq('status', 'COMPLETED')
    .gte('appointment_date', dateRange.startISO)
    .lte('appointment_date', dateRange.endISO)

  if (error || !data) {
    if (error) {
      console.error('Failed to load stored Square payments:', error)
    }
    return []
  }

  return data
    .filter((payment) => payment.payment_id)
    .map((payment) => ({
      paymentId: payment.payment_id,
      locationId: payment.location_id || null,
      orderId: payment.order_id || null,
      customerId: payment.customer_id || null,
      appointmentDate: payment.appointment_date || null,
      currency: payment.currency || null,
      amountTotal: Number(payment.amount_total || 0),
      tipAmount: Number(payment.tip_amount || 0),
      processingFee: Number(payment.processing_fee || 0),
      netAmount: payment.net_amount !== null ? Number(payment.net_amount) : null,
      status: payment.status || null,
      sourceType: payment.source_type || null,
      receiptNumber: payment.receipt_number || null,
      receiptUrl: payment.receipt_url || null,
      cardBrand: payment.card_brand || null,
      cardLast4: payment.card_last4 || null,
      createdAt: payment.created_at || null,
      updatedAt: payment.updated_at || null,
    }))
}

function matchSquarePaymentsToAppointments(
  appointments: NormalizedAppointment[],
  payments: SquarePaymentRecord[]
): { appointments: NormalizedAppointment[] } {
  const paymentTotalsByOrder = buildPaymentTotalsByOrder(payments)
  const fallbackIndex = buildFallbackPaymentIndex(payments)
  const usedPaymentIds = new Set<string>()

  const updatedAppointments = appointments.map((appointment) => {
    if (appointment.orderId) {
      const totals = paymentTotalsByOrder.get(appointment.orderId)
      if (totals) {
        totals.paymentIds.forEach((id) => usedPaymentIds.add(id))
        return {
          ...appointment,
          price: totals.total,
          tip: totals.tip,
          paymentId: totals.paymentIds.length === 1 ? totals.paymentIds[0] : appointment.paymentId,
        }
      }
    }

    const fallbackKey = buildFallbackKey(appointment.customerId, appointment.date)
    if (!fallbackKey) return appointment

    const candidates = (fallbackIndex.get(fallbackKey) || []).filter(
      (payment) => !usedPaymentIds.has(payment.paymentId)
    )

    const filteredCandidates = filterPaymentsByLocation(candidates, appointment.locationId)
    if (filteredCandidates.length === 0) return appointment

    const selected = selectClosestPayment(appointment, filteredCandidates)
    if (!selected) return appointment

    usedPaymentIds.add(selected.paymentId)

    return {
      ...appointment,
      price: selected.amountTotal,
      tip: selected.tipAmount,
      paymentId: selected.paymentId,
    }
  })

  return { appointments: updatedAppointments }
}

function buildFallbackPaymentIndex(
  payments: SquarePaymentRecord[]
): Map<string, SquarePaymentRecord[]> {
  const index = new Map<string, SquarePaymentRecord[]>()

  for (const payment of payments) {
    if (!payment.customerId || !payment.appointmentDate) continue
    const key = buildFallbackKey(payment.customerId, payment.appointmentDate)
    if (!key) continue

    const bucket = index.get(key) || []
    bucket.push(payment)
    index.set(key, bucket)
  }

  return index
}

function buildFallbackKey(customerId: string | null | undefined, date: string | null | undefined): string | null {
  if (!customerId || !date) return null
  return `${customerId}|${date}`
}

function filterPaymentsByLocation(
  payments: SquarePaymentRecord[],
  locationId: string | null | undefined
): SquarePaymentRecord[] {
  if (!locationId) return payments
  return payments.filter(
    (payment) => !payment.locationId || payment.locationId === locationId
  )
}

function selectClosestPayment(
  appointment: NormalizedAppointment,
  payments: SquarePaymentRecord[]
): SquarePaymentRecord | null {
  if (payments.length === 0) return null

  const appointmentTime = parseDateToMillis(appointment.datetime || null)
  const amount = appointment.price || 0
  const amountTolerance = amount > 0 ? Math.max(1, amount * 0.05) : null

  const amountFiltered = amountTolerance
    ? payments.filter((payment) =>
        Math.abs(payment.amountTotal - amount) <= amountTolerance
      )
    : payments

  const candidates = amountFiltered.length > 0 ? amountFiltered : payments

  if (!appointmentTime) return candidates[0]

  return candidates.reduce((closest, payment) => {
    const paymentTime = parseDateToMillis(payment.createdAt || payment.appointmentDate)
    if (!paymentTime) return closest

    const closestTime = parseDateToMillis(closest.createdAt || closest.appointmentDate)
    if (!closestTime) return payment

    return Math.abs(paymentTime - appointmentTime) < Math.abs(closestTime - appointmentTime)
      ? payment
      : closest
  }, candidates[0])
}

function parseDateToMillis(value: string | null | undefined): number | null {
  if (!value) return null
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.getTime()
}

async function upsertSquarePayments(
  supabase: SupabaseClient,
  userId: string,
  merchantId: string,
  payments: SquarePaymentRecord[]
): Promise<void> {
  if (payments.length === 0) return

  const now = new Date().toISOString()
  const safeMerchantId = merchantId || 'unknown'

  const rows = payments.map((payment) => ({
    payment_id: payment.paymentId,
    user_id: userId,
    merchant_id: safeMerchantId,
    location_id: payment.locationId,
    order_id: payment.orderId,
    customer_id: payment.customerId,
    appointment_date: payment.appointmentDate,
    currency: payment.currency,
    amount_total: payment.amountTotal,
    tip_amount: payment.tipAmount,
    processing_fee: payment.processingFee,
    net_amount: payment.netAmount,
    status: payment.status,
    source_type: payment.sourceType,
    receipt_number: payment.receiptNumber,
    receipt_url: payment.receiptUrl,
    card_brand: payment.cardBrand,
    card_last4: payment.cardLast4,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt || now,
  }))

  const { error } = await supabase
    .from('square_payments')
    .upsert(rows, { onConflict: 'user_id,payment_id' })

  if (error) {
    console.error('Square payments upsert error:', error)
    throw error
  }
}

// ======================== CONVENIENCE FUNCTIONS ========================

/**
 * Pull a single month of data.
 */
export async function pullMonth(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: Month,
  orchestratorOptions?: OrchestratorOptions
): Promise<PullResult> {
  return pull(
    supabase,
    userId,
    { granularity: 'month', year, month },
    orchestratorOptions
  )
}

/**
 * Pull a single day of data.
 */
export async function pullDay(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: Month,
  day: number,
  orchestratorOptions?: OrchestratorOptions
): Promise<PullResult> {
  return pull(
    supabase,
    userId,
    { granularity: 'day', year, month, day },
    orchestratorOptions
  )
}

/**
 * Pull a quarter of data.
 */
export async function pullQuarter(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
  orchestratorOptions?: OrchestratorOptions
): Promise<PullResult> {
  return pull(
    supabase,
    userId,
    { granularity: 'quarter', year, quarter },
    orchestratorOptions
  )
}

/**
 * Pull an entire year of data.
 */
export async function pullYear(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  orchestratorOptions?: OrchestratorOptions
): Promise<PullResult> {
  return pull(
    supabase,
    userId,
    { granularity: 'year', year },
    orchestratorOptions
  )
}