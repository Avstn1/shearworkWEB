// app/api/tests/test-end-to-end/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { AcuityAdapter } from '@/lib/booking/adapters/acuity'
import { ClientProcessor } from '@/lib/booking/processors/clients'
import { AppointmentProcessor } from '@/lib/booking/processors/appointments'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || 'January'
  const year = parseInt(searchParams.get('year') || '2025', 10)

  // ======================== STEP 1: ADAPTER ========================

  const adapter = new AcuityAdapter()
  let accessToken: string
  let calendarId: string

  try {
    accessToken = await adapter.ensureValidToken(supabase, user.id)
  } catch (err) {
    return NextResponse.json({
      success: false,
      step: 'ensureValidToken',
      error: String(err),
    }, { status: 500 })
  }

  try {
    calendarId = await adapter.getCalendarId(accessToken, supabase, user.id)
  } catch (err) {
    return NextResponse.json({
      success: false,
      step: 'getCalendarId',
      error: String(err),
    }, { status: 500 })
  }

  // Calculate date range for the month
  const monthIndex = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ].indexOf(month)

  if (monthIndex === -1) {
    return NextResponse.json({
      success: false,
      error: `Invalid month: ${month}`,
    }, { status: 400 })
  }

  const startDate = new Date(year, monthIndex, 1)
  const endDate = new Date(year, monthIndex + 1, 0) // Last day of month

  const dateRange = {
    startISO: startDate.toISOString().split('T')[0],
    endISO: endDate.toISOString().split('T')[0],
  }

  // ======================== STEP 2: FETCH APPOINTMENTS ========================

  let appointments
  try {
    appointments = await adapter.fetchAppointments(accessToken, calendarId, dateRange)
  } catch (err) {
    return NextResponse.json({
      success: false,
      step: 'fetchAppointments',
      error: String(err),
    }, { status: 500 })
  }

  // ======================== STEP 3: CLIENT PROCESSOR ========================

  let clientResolution
  let clientUpsertPayload
  try {
    const clientProcessor = new ClientProcessor(supabase, user.id)
    clientResolution = await clientProcessor.resolve(appointments)
    clientUpsertPayload = clientProcessor.getUpsertPayload()
  } catch (err) {
    return NextResponse.json({
      success: false,
      step: 'clientProcessor',
      error: String(err),
      stack: (err as Error).stack,
    }, { status: 500 })
  }

  // ======================== STEP 4: APPOINTMENT PROCESSOR ========================

  let appointmentUpsertPayload
  let appointmentsWithValues
  let skippedCount
  try {
    const appointmentProcessor = new AppointmentProcessor(supabase, user.id)
    appointmentProcessor.process(appointments, clientResolution)
    appointmentUpsertPayload = appointmentProcessor.getUpsertPayload()
    appointmentsWithValues = appointmentProcessor.getAppointmentsWithValues()
    skippedCount = appointmentProcessor.getSkippedCount()
  } catch (err) {
    return NextResponse.json({
      success: false,
      step: 'appointmentProcessor',
      error: String(err),
      stack: (err as Error).stack,
    }, { status: 500 })
  }

  // ======================== FIND SKIPPED APPOINTMENTS ========================

  const upsertedIds = new Set(appointmentUpsertPayload.map(a => a.acuity_appointment_id))
  const skippedAppointments = appointments.filter(a => !upsertedIds.has(a.externalId))

  // ======================== ANALYZE RESULTS ========================

  const results: Record<string, any> = {}

  // Summary
  results.summary = {
    dateRange,
    month,
    year,
    appointmentsFetched: appointments.length,
    clientsResolved: clientResolution.clients.size,
    newClients: clientResolution.newClientIds.size,
    appointmentsToUpsert: appointmentUpsertPayload.length,
    appointmentsSkipped: skippedCount,
  }

  // Skipped appointments detail
  results.skippedAppointments = skippedAppointments.map(a => ({
    externalId: a.externalId,
    date: a.date,
    datetime: a.datetime,
    email: a.email,
    phone: a.phone,
    phoneNormalized: a.phoneNormalized,
    firstName: a.firstName,
    lastName: a.lastName,
    service: a.serviceType,
    price: a.price,
    reason: getSkipReason(a),
  }))

  // Revenue analysis
  const totalRevenue = appointmentsWithValues.reduce((sum, a) => sum + a.acuityRevenue, 0)
  const totalTips = appointmentsWithValues.reduce((sum, a) => sum + a.acuityTip, 0)

  results.revenueAnalysis = {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalTips: Math.round(totalTips * 100) / 100,
    totalCombined: Math.round((totalRevenue + totalTips) * 100) / 100,
    averageTicket: appointments.length > 0 
      ? Math.round((totalRevenue / appointments.length) * 100) / 100 
      : 0,
    averageTip: appointments.length > 0 
      ? Math.round((totalTips / appointments.length) * 100) / 100 
      : 0,
  }

  // Service breakdown
  const serviceBreakdown: Record<string, { count: number; revenue: number; tips: number }> = {}
  for (const appt of appointmentsWithValues) {
    const service = appt.row.service_type || 'Unknown'
    if (!serviceBreakdown[service]) {
      serviceBreakdown[service] = { count: 0, revenue: 0, tips: 0 }
    }
    serviceBreakdown[service].count++
    serviceBreakdown[service].revenue += appt.acuityRevenue
    serviceBreakdown[service].tips += appt.acuityTip
  }
  results.serviceBreakdown = serviceBreakdown

  // Referral source breakdown
  const sourceBreakdown: Record<string, number> = {}
  for (const [_, client] of clientResolution.clients) {
    const source = client.firstSource || 'Unknown'
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1
  }
  results.sourceBreakdown = sourceBreakdown

  // Client visit distribution
  const clientAppointmentCounts: Record<string, number> = {}
  for (const appt of appointmentUpsertPayload) {
    clientAppointmentCounts[appt.client_id] = (clientAppointmentCounts[appt.client_id] || 0) + 1
  }

  const visitDistribution: Record<string, number> = {}
  for (const count of Object.values(clientAppointmentCounts)) {
    const key = count >= 5 ? '5+' : String(count)
    visitDistribution[key] = (visitDistribution[key] || 0) + 1
  }
  results.visitDistribution = visitDistribution

  // Date distribution (appointments per day)
  const dateDistribution: Record<string, number> = {}
  for (const appt of appointmentUpsertPayload) {
    dateDistribution[appt.appointment_date] = (dateDistribution[appt.appointment_date] || 0) + 1
  }
  results.appointmentsPerDay = {
    totalDaysWithAppointments: Object.keys(dateDistribution).length,
    maxPerDay: Math.max(...Object.values(dateDistribution), 0),
    minPerDay: Math.min(...Object.values(dateDistribution), 0),
    avgPerDay: Object.keys(dateDistribution).length > 0
      ? Math.round((appointments.length / Object.keys(dateDistribution).length) * 100) / 100
      : 0,
  }

  // ======================== VALIDATIONS ========================

  const validations: Record<string, boolean> = {}

  // Basic validations
  validations['Appointments fetched > 0'] = appointments.length > 0
  validations['Clients resolved > 0'] = clientResolution.clients.size > 0
  validations['All appointments have externalId'] = appointments.every(a => a.externalId)
  validations['All appointments have date'] = appointments.every(a => a.date)
  validations['All upsert rows have user_id'] = appointmentUpsertPayload.every(a => a.user_id === user.id)
  validations['All upsert rows have client_id'] = appointmentUpsertPayload.every(a => a.client_id)
  validations['All upsert rows have acuity_appointment_id'] = appointmentUpsertPayload.every(a => a.acuity_appointment_id)

  // Phone normalization
  const appointmentsWithPhone = appointments.filter(a => a.phone)
  const normalizedPhones = appointments.filter(a => a.phoneNormalized)
  validations['Phones normalized where possible'] = 
    appointmentsWithPhone.length === 0 || normalizedPhones.length > 0

  // Email normalization
  const appointmentsWithEmail = appointments.filter(a => a.email)
  const lowercaseEmails = appointmentsWithEmail.filter(a => a.email === a.email?.toLowerCase())
  validations['Emails lowercased'] = 
    appointmentsWithEmail.length === 0 || lowercaseEmails.length === appointmentsWithEmail.length

  // Client-appointment linkage
  const clientIds = new Set(clientResolution.clients.keys())
  const appointmentClientIds = new Set(appointmentUpsertPayload.map(a => a.client_id))
  const allLinked = [...appointmentClientIds].every(id => clientIds.has(id))
  validations['All appointments linked to valid clients'] = allLinked

  // No duplicate appointments in output
  const externalIds = appointmentUpsertPayload.map(a => a.acuity_appointment_id)
  const uniqueExternalIds = new Set(externalIds)
  validations['No duplicate appointment IDs'] = externalIds.length === uniqueExternalIds.size

  // Revenue sanity check
  validations['Total revenue >= 0'] = totalRevenue >= 0
  validations['Total tips >= 0'] = totalTips >= 0

  // Skipped appointments validation
  validations['Skipped count matches'] = skippedAppointments.length === skippedCount
  validations['All skipped have valid reason'] = skippedAppointments.every(a => {
    const hasNoPhone = !a.phoneNormalized
    const hasNoEmail = !a.email || a.email.trim() === ''
    const hasNoValidName = !a.firstName || !a.lastName || 
      a.firstName.trim().length < 2 || a.lastName.trim().length < 2
    return hasNoPhone && hasNoEmail && hasNoValidName
  })

  results.validations = validations
  results.allPassed = Object.values(validations).every(v => v)

  // Sample data (first 5 of each)
  results.sampleData = {
    appointments: appointments.slice(0, 5).map(a => ({
      externalId: a.externalId,
      date: a.date,
      email: a.email,
      phone: a.phoneNormalized,
      name: `${a.firstName || ''} ${a.lastName || ''}`.trim(),
      service: a.serviceType,
      price: a.price,
      tip: a.tip,
      source: a.referralSource,
    })),
    clients: Array.from(clientResolution.clients.values()).slice(0, 5).map(c => ({
      clientId: c.clientId.substring(0, 8) + '...',
      email: c.email,
      phone: c.phoneNormalized,
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      firstAppt: c.firstAppt,
      secondAppt: c.secondAppt,
      lastAppt: c.lastAppt,
      firstSource: c.firstSource,
    })),
  }

  return NextResponse.json({
    success: true,
    dryRun: true,
    note: 'No data was written to the database. This test validates the full pipeline from Acuity → Clients → Appointments.',
    results,
  })
}

// Helper function to determine why an appointment was skipped
function getSkipReason(appt: any): string {
  const reasons: string[] = []

  if (!appt.phoneNormalized) {
    if (!appt.phone) {
      reasons.push('No phone')
    } else {
      reasons.push(`Phone not normalizable: "${appt.phone}"`)
    }
  }

  if (!appt.email || appt.email.trim() === '') {
    reasons.push('No email')
  }

  if (!appt.firstName || appt.firstName.trim().length < 2) {
    reasons.push(`Invalid first name: "${appt.firstName || ''}"`)
  }

  if (!appt.lastName || appt.lastName.trim().length < 2) {
    reasons.push(`Invalid last name: "${appt.lastName || ''}"`)
  }

  return reasons.join(', ')
}
// ```

// ---

// ## What This Test Does
// ```
// ┌─────────────────────────────────────────────────────────────────┐
// │                    END-TO-END PIPELINE TEST                     │
// └─────────────────────────────────────────────────────────────────┘
//                               │
//                               ▼
// ┌─────────────────────────────────────────────────────────────────┐
// │ STEP 1: AcuityAdapter                                           │
// │   • ensureValidToken() — Refresh OAuth if needed                │
// │   • getCalendarId() — Match calendar from profile               │
// │   • fetchAppointments() — Day-by-day pagination                 │
// └─────────────────────────────────────────────────────────────────┘
//                               │
//                               ▼
// ┌─────────────────────────────────────────────────────────────────┐
// │ STEP 2: ClientProcessor                                         │
// │   • resolve() — Identity resolution (phone → email → name)      │
// │   • getUpsertPayload() — Preview client rows                    │
// └─────────────────────────────────────────────────────────────────┘
//                               │
//                               ▼
// ┌─────────────────────────────────────────────────────────────────┐
// │ STEP 3: AppointmentProcessor                                    │
// │   • process() — Link appointments to client_ids                 │
// │   • getUpsertPayload() — Preview appointment rows               │
// └─────────────────────────────────────────────────────────────────┘
//                               │
//                               ▼
// ┌─────────────────────────────────────────────────────────────────┐
// │ ANALYSIS & VALIDATIONS                                          │
// │   • Revenue breakdown                                           │
// │   • Service breakdown                                           │
// │   • Referral source breakdown                                   │
// │   • Visit distribution                                          │
// │   • Data integrity checks                                       │
// └─────────────────────────────────────────────────────────────────┘
// ```

// ---

// ## Usage
// ```
// http://localhost:3000/api/tests/test-end-to-end?month=January&year=2025
// http://localhost:3000/api/tests/test-end-to-end?month=December&year=2024