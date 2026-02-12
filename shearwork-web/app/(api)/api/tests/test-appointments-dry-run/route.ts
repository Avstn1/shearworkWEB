// app/api/tests/test-appointments-dry-run/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { ClientProcessor } from '@/lib/booking/processors/clients'
import { AppointmentProcessor } from '@/lib/booking/processors/appointments'
import { NormalizedAppointment } from '@/lib/booking/types'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // ======================== TEST DATA ========================

  const testAppointments: NormalizedAppointment[] = [
    // -------- Client 1: Alice - 2 appointments --------
    {
      externalId: 'dry-run-001',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'alice.dry@example.com',
      phone: '+14165550001',
      phoneNormalized: '+14165550001',
      firstName: 'Alice',
      lastName: 'Dryrun',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: 'First visit',
      referralSource: 'Instagram',
    },
    {
      externalId: 'dry-run-002',
      datetime: '2025-01-15T14:00:00',
      date: '2025-01-15',
      email: 'alice.dry@example.com',
      phone: '+14165550001',
      phoneNormalized: '+14165550001',
      firstName: 'Alice',
      lastName: 'Dryrun',
      serviceType: 'Color',
      price: 120,
      tip: 25,
      notes: 'Second visit - color service',
      referralSource: null,
    },

    // -------- Client 2: Bob - 1 appointment --------
    {
      externalId: 'dry-run-003',
      datetime: '2025-01-12T11:00:00',
      date: '2025-01-12',
      email: 'bob.dry@example.com',
      phone: '+14165550002',
      phoneNormalized: '+14165550002',
      firstName: 'Bob',
      lastName: 'Dryrun',
      serviceType: 'Beard Trim',
      price: 25,
      tip: 5,
      notes: null,
      referralSource: 'Google',
    },

    // -------- Client 3: Charlie - phone only --------
    {
      externalId: 'dry-run-004',
      datetime: '2025-01-18T16:00:00',
      date: '2025-01-18',
      email: null,
      phone: '+14165550003',
      phoneNormalized: '+14165550003',
      firstName: 'Charlie',
      lastName: 'Phoneman',
      serviceType: 'Buzz Cut',
      price: 30,
      tip: 8,
      notes: 'Phone only client',
      referralSource: 'Walk-in',
    },

    // -------- Client 4: Diana - email only --------
    {
      externalId: 'dry-run-005',
      datetime: '2025-01-20T09:00:00',
      date: '2025-01-20',
      email: 'diana.dry@example.com',
      phone: null,
      phoneNormalized: null,
      firstName: 'Diana',
      lastName: 'Emailonly',
      serviceType: 'Highlights',
      price: 150,
      tip: 30,
      notes: 'Email only client',
      referralSource: 'Referral',
    },

    // -------- SKIP: No identifiers --------
    {
      externalId: 'dry-run-006',
      datetime: '2025-01-22T10:00:00',
      date: '2025-01-22',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: null,
      lastName: null,
      serviceType: 'Mystery Service',
      price: 100,
      tip: 20,
      notes: 'Should be skipped - no client info',
      referralSource: null,
    },

    // -------- SKIP: Empty strings (treated as null) --------
    {
      externalId: 'dry-run-007',
      datetime: '2025-01-23T11:00:00',
      date: '2025-01-23',
      email: '   ',
      phone: '',
      phoneNormalized: null,
      firstName: '  ',
      lastName: '',
      serviceType: 'Another Mystery',
      price: 75,
      tip: 15,
      notes: 'Should be skipped - empty strings',
      referralSource: null,
    },

    // -------- Client 5: Eve - same day, multiple services --------
    {
      externalId: 'dry-run-008',
      datetime: '2025-01-25T10:00:00',
      date: '2025-01-25',
      email: 'eve.dry@example.com',
      phone: '+14165550005',
      phoneNormalized: '+14165550005',
      firstName: 'Eve',
      lastName: 'Multiservice',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: 'Morning appointment',
      referralSource: 'TikTok',
    },
    {
      externalId: 'dry-run-009',
      datetime: '2025-01-25T14:00:00',
      date: '2025-01-25',
      email: 'eve.dry@example.com',
      phone: '+14165550005',
      phoneNormalized: '+14165550005',
      firstName: 'Eve',
      lastName: 'Multiservice',
      serviceType: 'Blowout',
      price: 40,
      tip: 8,
      notes: 'Afternoon appointment - same day',
      referralSource: null,
    },

    // -------- Client 6: Frank - high value --------
    {
      externalId: 'dry-run-010',
      datetime: '2025-01-28T15:00:00',
      date: '2025-01-28',
      email: 'frank.dry@example.com',
      phone: '+14165550006',
      phoneNormalized: '+14165550006',
      firstName: 'Frank',
      lastName: 'Highvalue',
      serviceType: 'Full Treatment',
      price: 500,
      tip: 100,
      notes: 'VIP client - high value service',
      referralSource: 'Facebook',
    },
  ]

  // ======================== RUN PROCESSORS (DRY RUN) ========================

  try {
    // Step 1: Resolve clients
    const clientProcessor = new ClientProcessor(supabase, user.id)
    const clientResolution = await clientProcessor.resolve(testAppointments)
    const clientUpsertPayload = clientProcessor.getUpsertPayload()

    // Step 2: Process appointments (dry run - no upsert)
    const appointmentProcessor = new AppointmentProcessor(supabase, user.id)
    appointmentProcessor.process(testAppointments, clientResolution)
    const appointmentUpsertPayload = appointmentProcessor.getUpsertPayload()
    const appointmentsWithValues = appointmentProcessor.getAppointmentsWithValues()

    // ======================== ANALYZE RESULTS ========================

    const results: Record<string, any> = {}

    // Summary
    results.summary = {
      inputAppointments: testAppointments.length,
      clientsResolved: clientResolution.clients.size,
      newClients: clientResolution.newClientIds.size,
      appointmentsToUpsert: appointmentUpsertPayload.length,
      appointmentsSkipped: appointmentProcessor.getSkippedCount(),
    }

    // Group appointments by client
    const appointmentsByClient: Record<string, any[]> = {}
    for (const appt of appointmentUpsertPayload) {
      const clientId = appt.client_id
      if (!appointmentsByClient[clientId]) {
        appointmentsByClient[clientId] = []
      }
      appointmentsByClient[clientId].push({
        externalId: appt.acuity_appointment_id,
        date: appt.appointment_date,
        service: appt.service_type,
      })
    }

    // Client details with their appointments
    results.clientsWithAppointments = Array.from(clientResolution.clients.entries()).map(([clientId, client]) => ({
      clientId: clientId.substring(0, 8) + '...',
      name: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
      email: client.email,
      phone: client.phoneNormalized,
      firstAppt: client.firstAppt,
      secondAppt: client.secondAppt,
      lastAppt: client.lastAppt,
      firstSource: client.firstSource,
      appointments: appointmentsByClient[clientId] || [],
    }))

    // Revenue summary
    const totalRevenue = appointmentsWithValues.reduce((sum, a) => sum + a.acuityRevenue, 0)
    const totalTips = appointmentsWithValues.reduce((sum, a) => sum + a.acuityTip, 0)

    results.revenueSummary = {
      totalRevenue,
      totalTips,
      totalCombined: totalRevenue + totalTips,
      averageTicket: appointmentsWithValues.length > 0 
        ? Math.round(totalRevenue / appointmentsWithValues.length * 100) / 100 
        : 0,
      averageTip: appointmentsWithValues.length > 0 
        ? Math.round(totalTips / appointmentsWithValues.length * 100) / 100 
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

    // ======================== VALIDATIONS ========================

    const validations: Record<string, boolean> = {}

    // Count validations
    validations['10 input appointments'] = testAppointments.length === 10
    validations['8 appointments processed'] = appointmentUpsertPayload.length === 8
    validations['2 appointments skipped'] = appointmentProcessor.getSkippedCount() === 2
    validations['6 unique clients'] = clientResolution.clients.size === 6

    // Client grouping validations
    const aliceAppts = appointmentUpsertPayload.filter(a => 
      a.acuity_appointment_id === 'dry-run-001' || a.acuity_appointment_id === 'dry-run-002'
    )
    validations['Alice has 2 appointments'] = aliceAppts.length === 2
    validations['Alice appointments share client_id'] = 
      aliceAppts.length === 2 && aliceAppts[0].client_id === aliceAppts[1].client_id

    const eveAppts = appointmentUpsertPayload.filter(a => 
      a.acuity_appointment_id === 'dry-run-008' || a.acuity_appointment_id === 'dry-run-009'
    )
    validations['Eve has 2 same-day appointments'] = eveAppts.length === 2
    validations['Eve appointments share client_id'] = 
      eveAppts.length === 2 && eveAppts[0].client_id === eveAppts[1].client_id

    // Revenue validations
    validations['Total revenue = 965'] = totalRevenue === 965  // 50+120+25+30+150+50+40+500
    validations['Total tips = 196'] = totalTips === 196  // 10+25+5+8+30+10+8+100 = 196

    // All appointments have required fields
    validations['All have user_id'] = appointmentUpsertPayload.every(a => a.user_id === user.id)
    validations['All have client_id'] = appointmentUpsertPayload.every(a => a.client_id)
    validations['All have appointment_date'] = appointmentUpsertPayload.every(a => a.appointment_date)
    validations['All have datetime'] = appointmentUpsertPayload.every(a => a.datetime)
    validations['All have acuity_appointment_id'] = appointmentUpsertPayload.every(a => a.acuity_appointment_id)

    // secondAppt validation for Alice (2 visits)
    const aliceClient = Array.from(clientResolution.clients.values()).find(c => c.email === 'alice.dry@example.com')
    validations['Alice firstAppt = 2025-01-10'] = aliceClient?.firstAppt === '2025-01-10'
    validations['Alice secondAppt = 2025-01-15'] = aliceClient?.secondAppt === '2025-01-15'
    validations['Alice lastAppt = 2025-01-15'] = aliceClient?.lastAppt === '2025-01-15'

    // secondAppt validation for Eve (2 same-day visits)
    const eveClient = Array.from(clientResolution.clients.values()).find(c => c.email === 'eve.dry@example.com')
    validations['Eve firstAppt = lastAppt (same day)'] = eveClient?.firstAppt === eveClient?.lastAppt
    validations['Eve secondAppt = null (same day visits)'] = eveClient?.secondAppt === null

    results.validations = validations
    results.allPassed = Object.values(validations).every(v => v)

    // Raw payloads for inspection
    results.rawPayloads = {
      clients: clientUpsertPayload.map(c => ({
        client_id: c.client_id.substring(0, 8) + '...',
        email: c.email,
        phone: c.phone_normalized,
        first_name: c.first_name,
        last_name: c.last_name,
        first_appt: c.first_appt,
        second_appt: c.second_appt,
        last_appt: c.last_appt,
      })),
      appointments: appointmentsWithValues.map(a => ({
        acuity_id: a.row.acuity_appointment_id,
        client_id: a.row.client_id.substring(0, 8) + '...',
        date: a.row.appointment_date,
        service: a.row.service_type,
        revenue: a.acuityRevenue,
        tip: a.acuityTip,
      })),
    }

    return NextResponse.json({ 
      success: true, 
      dryRun: true,
      note: 'No data was written to the database',
      results,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
      stack: (err as Error).stack,
    }, { status: 500 })
  }
}