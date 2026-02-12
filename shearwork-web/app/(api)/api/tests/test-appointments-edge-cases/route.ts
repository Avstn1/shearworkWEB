// app/api/tests/test-appointments-edge-cases/route.ts

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
    // -------- TEST 1: Zero revenue appointment --------
    {
      externalId: 'edge-appt-001',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'zero.revenue@example.com',
      phone: '+14165551001',
      phoneNormalized: '+14165551001',
      firstName: 'Zero',
      lastName: 'Revenue',
      serviceType: 'Free Consultation',
      price: 0,
      tip: 0,
      notes: 'Complimentary service',
      referralSource: 'Instagram',
    },

    // -------- TEST 2: Zero tip, has revenue --------
    {
      externalId: 'edge-appt-002',
      datetime: '2025-01-11T10:00:00',
      date: '2025-01-11',
      email: 'zero.tip@example.com',
      phone: '+14165551002',
      phoneNormalized: '+14165551002',
      firstName: 'Zero',
      lastName: 'Tipper',
      serviceType: 'Haircut',
      price: 50,
      tip: 0,
      notes: 'No tip given',
      referralSource: 'Google',
    },

    // -------- TEST 3: Very high values --------
    {
      externalId: 'edge-appt-003',
      datetime: '2025-01-12T10:00:00',
      date: '2025-01-12',
      email: 'high.value@example.com',
      phone: '+14165551003',
      phoneNormalized: '+14165551003',
      firstName: 'High',
      lastName: 'Roller',
      serviceType: 'VIP Package',
      price: 9999.99,
      tip: 2000,
      notes: 'Premium service',
      referralSource: 'Referral',
    },

    // -------- TEST 4: Decimal precision --------
    {
      externalId: 'edge-appt-004',
      datetime: '2025-01-13T10:00:00',
      date: '2025-01-13',
      email: 'decimal@example.com',
      phone: '+14165551004',
      phoneNormalized: '+14165551004',
      firstName: 'Decimal',
      lastName: 'Test',
      serviceType: 'Haircut',
      price: 49.99,
      tip: 10.01,
      notes: 'Test decimal handling',
      referralSource: 'Walk-in',
    },

    // -------- TEST 5: Long service type --------
    {
      externalId: 'edge-appt-005',
      datetime: '2025-01-14T10:00:00',
      date: '2025-01-14',
      email: 'long.service@example.com',
      phone: '+14165551005',
      phoneNormalized: '+14165551005',
      firstName: 'Long',
      lastName: 'Service',
      serviceType: 'Super Deluxe Premium Platinum Gold VIP Executive Hair Treatment Package With All The Extras And More',
      price: 200,
      tip: 50,
      notes: 'Long service name test',
      referralSource: 'TikTok',
    },

    // -------- TEST 6: Null service type --------
    {
      externalId: 'edge-appt-006',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: 'null.service@example.com',
      phone: '+14165551006',
      phoneNormalized: '+14165551006',
      firstName: 'Null',
      lastName: 'Service',
      serviceType: null,
      price: 75,
      tip: 15,
      notes: 'No service type specified',
      referralSource: 'Facebook',
    },

    // -------- TEST 7: Long notes --------
    {
      externalId: 'edge-appt-007',
      datetime: '2025-01-16T10:00:00',
      date: '2025-01-16',
      email: 'long.notes@example.com',
      phone: '+14165551007',
      phoneNormalized: '+14165551007',
      firstName: 'Long',
      lastName: 'Notes',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: 'This is a very long note that contains a lot of information about the client and their preferences. They like their hair cut short on the sides but longer on top. They prefer product recommendations for thick hair. They mentioned they have a wedding coming up and want to look their best. Previous visits have been good experiences. They always tip well and are very friendly. Allergic to certain hair products containing sulfates. Prefers appointments in the morning. Has been coming for 2 years now.',
      referralSource: 'Referral',
    },

    // -------- TEST 8: Null notes --------
    {
      externalId: 'edge-appt-008',
      datetime: '2025-01-17T10:00:00',
      date: '2025-01-17',
      email: 'null.notes@example.com',
      phone: '+14165551008',
      phoneNormalized: '+14165551008',
      firstName: 'Null',
      lastName: 'Notes',
      serviceType: 'Beard Trim',
      price: 25,
      tip: 5,
      notes: null,
      referralSource: 'Instagram',
    },

    // -------- TEST 9: Unicode in service type and notes --------
    {
      externalId: 'edge-appt-009',
      datetime: '2025-01-18T10:00:00',
      date: '2025-01-18',
      email: 'unicode@example.com',
      phone: '+14165551009',
      phoneNormalized: '+14165551009',
      firstName: 'José',
      lastName: 'García',
      serviceType: 'Corte de Pelo Clásico',
      price: 45,
      tip: 10,
      notes: 'Cliente prefiere música en español 🎵. Usar tijeras, no máquina. Très bien!',
      referralSource: 'Google',
    },

    // -------- TEST 10: Same client, many appointments (5) --------
    {
      externalId: 'edge-appt-010a',
      datetime: '2025-01-01T10:00:00',
      date: '2025-01-01',
      email: 'frequent@example.com',
      phone: '+14165551010',
      phoneNormalized: '+14165551010',
      firstName: 'Frequent',
      lastName: 'Visitor',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: 'Visit 1',
      referralSource: 'Walk-in',
    },
    {
      externalId: 'edge-appt-010b',
      datetime: '2025-01-08T10:00:00',
      date: '2025-01-08',
      email: 'frequent@example.com',
      phone: '+14165551010',
      phoneNormalized: '+14165551010',
      firstName: 'Frequent',
      lastName: 'Visitor',
      serviceType: 'Beard Trim',
      price: 25,
      tip: 5,
      notes: 'Visit 2',
      referralSource: null,
    },
    {
      externalId: 'edge-appt-010c',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: 'frequent@example.com',
      phone: '+14165551010',
      phoneNormalized: '+14165551010',
      firstName: 'Frequent',
      lastName: 'Visitor',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: 'Visit 3',
      referralSource: null,
    },
    {
      externalId: 'edge-appt-010d',
      datetime: '2025-01-22T10:00:00',
      date: '2025-01-22',
      email: 'frequent@example.com',
      phone: '+14165551010',
      phoneNormalized: '+14165551010',
      firstName: 'Frequent',
      lastName: 'Visitor',
      serviceType: 'Color',
      price: 100,
      tip: 20,
      notes: 'Visit 4',
      referralSource: null,
    },
    {
      externalId: 'edge-appt-010e',
      datetime: '2025-01-29T10:00:00',
      date: '2025-01-29',
      email: 'frequent@example.com',
      phone: '+14165551010',
      phoneNormalized: '+14165551010',
      firstName: 'Frequent',
      lastName: 'Visitor',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: 'Visit 5',
      referralSource: null,
    },

    // -------- TEST 11: Duplicate externalId (should only process once) --------
    {
      externalId: 'edge-appt-011-dupe',
      datetime: '2025-01-20T10:00:00',
      date: '2025-01-20',
      email: 'dupe1@example.com',
      phone: '+14165551011',
      phoneNormalized: '+14165551011',
      firstName: 'Dupe',
      lastName: 'First',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: 'First occurrence',
      referralSource: 'Instagram',
    },
    {
      externalId: 'edge-appt-011-dupe',  // Same ID!
      datetime: '2025-01-20T14:00:00',
      date: '2025-01-20',
      email: 'dupe2@example.com',
      phone: '+14165551012',
      phoneNormalized: '+14165551012',
      firstName: 'Dupe',
      lastName: 'Second',
      serviceType: 'Color',
      price: 100,
      tip: 20,
      notes: 'Second occurrence - should be skipped or overwrite',
      referralSource: 'Google',
    },

    // -------- TEST 12: Very old date --------
    {
      externalId: 'edge-appt-012',
      datetime: '2020-01-15T10:00:00',
      date: '2020-01-15',
      email: 'old.date@example.com',
      phone: '+14165551013',
      phoneNormalized: '+14165551013',
      firstName: 'Old',
      lastName: 'Timer',
      serviceType: 'Haircut',
      price: 40,
      tip: 8,
      notes: 'Historical appointment from 2020',
      referralSource: 'Referral',
    },

    // -------- TEST 13: Future date --------
    {
      externalId: 'edge-appt-013',
      datetime: '2030-06-15T10:00:00',
      date: '2030-06-15',
      email: 'future@example.com',
      phone: '+14165551014',
      phoneNormalized: '+14165551014',
      firstName: 'Future',
      lastName: 'Client',
      serviceType: 'Haircut',
      price: 60,
      tip: 12,
      notes: 'Future appointment - should still process',
      referralSource: 'TikTok',
    },

    // -------- TEST 14: Multiple appointments same datetime --------
    {
      externalId: 'edge-appt-014a',
      datetime: '2025-01-25T10:00:00',
      date: '2025-01-25',
      email: 'sametime.a@example.com',
      phone: '+14165551015',
      phoneNormalized: '+14165551015',
      firstName: 'SameTime',
      lastName: 'ClientA',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: 'Same datetime as another appointment',
      referralSource: 'Walk-in',
    },
    {
      externalId: 'edge-appt-014b',
      datetime: '2025-01-25T10:00:00',  // Exact same datetime
      date: '2025-01-25',
      email: 'sametime.b@example.com',
      phone: '+14165551016',
      phoneNormalized: '+14165551016',
      firstName: 'SameTime',
      lastName: 'ClientB',
      serviceType: 'Beard Trim',
      price: 25,
      tip: 5,
      notes: 'Same datetime as another appointment',
      referralSource: 'Google',
    },

    // -------- TEST 15: Empty string service type (should become null?) --------
    {
      externalId: 'edge-appt-015',
      datetime: '2025-01-26T10:00:00',
      date: '2025-01-26',
      email: 'empty.service@example.com',
      phone: '+14165551017',
      phoneNormalized: '+14165551017',
      firstName: 'Empty',
      lastName: 'ServiceType',
      serviceType: '',
      price: 50,
      tip: 10,
      notes: 'Empty string service type',
      referralSource: 'Facebook',
    },

    // -------- TEST 16: Whitespace service type --------
    {
      externalId: 'edge-appt-016',
      datetime: '2025-01-27T10:00:00',
      date: '2025-01-27',
      email: 'whitespace.service@example.com',
      phone: '+14165551018',
      phoneNormalized: '+14165551018',
      firstName: 'Whitespace',
      lastName: 'ServiceType',
      serviceType: '   ',
      price: 50,
      tip: 10,
      notes: 'Whitespace-only service type',
      referralSource: 'Instagram',
    },
  ]

  // ======================== RUN PROCESSORS (DRY RUN) ========================

  try {
    // Step 1: Resolve clients
    const clientProcessor = new ClientProcessor(supabase, user.id)
    const clientResolution = await clientProcessor.resolve(testAppointments)

    // Step 2: Process appointments
    const appointmentProcessor = new AppointmentProcessor(supabase, user.id)
    appointmentProcessor.process(testAppointments, clientResolution)
    const upsertPayload = appointmentProcessor.getUpsertPayload()
    const appointmentsWithValues = appointmentProcessor.getAppointmentsWithValues()

    // ======================== ANALYZE RESULTS ========================

    const results: Record<string, any> = {}

    results.summary = {
      inputAppointments: testAppointments.length,
      clientsResolved: clientResolution.clients.size,
      appointmentsToUpsert: upsertPayload.length,
      skipped: appointmentProcessor.getSkippedCount(),
    }

    // ======================== VALIDATIONS ========================

    const validations: Record<string, boolean> = {}

    // Helper to find appointment by ID
    const findAppt = (id: string) => appointmentsWithValues.find(a => a.row.acuity_appointment_id === id)
    const findClient = (email: string) => Array.from(clientResolution.clients.values()).find(c => c.email === email)

    // TEST 1: Zero revenue
    const zeroRevAppt = findAppt('edge-appt-001')
    validations['Test 1: Zero revenue processed'] = !!zeroRevAppt
    validations['Test 1: Revenue is 0'] = zeroRevAppt?.acuityRevenue === 0
    validations['Test 1: Tip is 0'] = zeroRevAppt?.acuityTip === 0

    // TEST 2: Zero tip
    const zeroTipAppt = findAppt('edge-appt-002')
    validations['Test 2: Zero tip processed'] = !!zeroTipAppt
    validations['Test 2: Revenue is 50'] = zeroTipAppt?.acuityRevenue === 50
    validations['Test 2: Tip is 0'] = zeroTipAppt?.acuityTip === 0

    // TEST 3: High values
    const highValueAppt = findAppt('edge-appt-003')
    validations['Test 3: High value processed'] = !!highValueAppt
    validations['Test 3: Revenue is 9999.99'] = highValueAppt?.acuityRevenue === 9999.99
    validations['Test 3: Tip is 2000'] = highValueAppt?.acuityTip === 2000

    // TEST 4: Decimal precision
    const decimalAppt = findAppt('edge-appt-004')
    validations['Test 4: Decimal processed'] = !!decimalAppt
    validations['Test 4: Revenue is 49.99'] = decimalAppt?.acuityRevenue === 49.99
    validations['Test 4: Tip is 10.01'] = decimalAppt?.acuityTip === 10.01

    // TEST 5: Long service type
    const longServiceAppt = findAppt('edge-appt-005')
    validations['Test 5: Long service type processed'] = !!longServiceAppt
    validations['Test 5: Service type preserved'] = !!(longServiceAppt?.row.service_type?.includes('Super Deluxe'))

    // TEST 6: Null service type
    const nullServiceAppt = findAppt('edge-appt-006')
    validations['Test 6: Null service processed'] = !!nullServiceAppt
    validations['Test 6: Service type is null'] = nullServiceAppt?.row.service_type === null

    // TEST 7: Long notes
    const longNotesAppt = findAppt('edge-appt-007')
    validations['Test 7: Long notes processed'] = !!longNotesAppt
    validations['Test 7: Notes preserved'] = (longNotesAppt?.row.notes?.length ?? 0) > 100

    // TEST 8: Null notes
    const nullNotesAppt = findAppt('edge-appt-008')
    validations['Test 8: Null notes processed'] = !!nullNotesAppt
    validations['Test 8: Notes is null'] = nullNotesAppt?.row.notes === null

    // TEST 9: Unicode
    const unicodeAppt = findAppt('edge-appt-009')
    validations['Test 9: Unicode processed'] = !!unicodeAppt
    validations['Test 9: Unicode service preserved'] = unicodeAppt?.row.service_type === 'Corte de Pelo Clásico'
    validations['Test 9: Unicode notes preserved'] = !!(unicodeAppt?.row.notes?.includes('🎵'))

    // TEST 10: Frequent visitor (5 appointments)
    const frequentClient = findClient('frequent@example.com')
    const frequentAppts = upsertPayload.filter(a => 
      a.acuity_appointment_id.startsWith('edge-appt-010')
    )
    validations['Test 10: 5 appointments for frequent visitor'] = frequentAppts.length === 5
    validations['Test 10: All share same client_id'] = 
      frequentAppts.length === 5 && 
      new Set(frequentAppts.map(a => a.client_id)).size === 1
    validations['Test 10: firstAppt = 2025-01-01'] = frequentClient?.firstAppt === '2025-01-01'
    validations['Test 10: secondAppt = 2025-01-08'] = frequentClient?.secondAppt === '2025-01-08'
    validations['Test 10: lastAppt = 2025-01-29'] = frequentClient?.lastAppt === '2025-01-29'

    // TEST 11: Duplicate externalId - both should process (DB handles dedup)
    const dupeAppts = upsertPayload.filter(a => a.acuity_appointment_id === 'edge-appt-011-dupe')
    validations['Test 11: Duplicate IDs both in payload'] = dupeAppts.length === 2

    // TEST 12: Old date
    const oldDateAppt = findAppt('edge-appt-012')
    validations['Test 12: Old date (2020) processed'] = !!oldDateAppt
    validations['Test 12: Date preserved'] = oldDateAppt?.row.appointment_date === '2020-01-15'

    // TEST 13: Future date
    const futureDateAppt = findAppt('edge-appt-013')
    validations['Test 13: Future date (2030) processed'] = !!futureDateAppt
    validations['Test 13: Date preserved'] = futureDateAppt?.row.appointment_date === '2030-06-15'

    // TEST 14: Same datetime, different clients
    const sameTimeA = findAppt('edge-appt-014a')
    const sameTimeB = findAppt('edge-appt-014b')
    validations['Test 14: Both same-time appointments processed'] = !!sameTimeA && !!sameTimeB
    validations['Test 14: Different client_ids'] = 
      !!(sameTimeA && sameTimeB && sameTimeA.row.client_id !== sameTimeB.row.client_id)

    // TEST 15: Empty string service type
    const emptyServiceAppt = findAppt('edge-appt-015')
    validations['Test 15: Empty service processed'] = !!emptyServiceAppt
    validations['Test 15: Empty string preserved or nullified'] = 
      emptyServiceAppt?.row.service_type === '' || emptyServiceAppt?.row.service_type === null

    // TEST 16: Whitespace service type
    const whitespaceServiceAppt = findAppt('edge-appt-016')
    validations['Test 16: Whitespace service processed'] = !!whitespaceServiceAppt

    // Count validations
    const totalValidations = Object.keys(validations).length
    const passedValidations = Object.values(validations).filter(v => v).length

    results.validations = validations
    results.validationSummary = {
      total: totalValidations,
      passed: passedValidations,
      failed: totalValidations - passedValidations,
    }
    results.allPassed = passedValidations === totalValidations

    // Detailed data for debugging
    results.detailedData = {
      frequentVisitor: {
        client: frequentClient ? {
          firstAppt: frequentClient.firstAppt,
          secondAppt: frequentClient.secondAppt,
          lastAppt: frequentClient.lastAppt,
        } : null,
        appointmentCount: frequentAppts.length,
      },
      duplicateIds: dupeAppts.length,
      serviceTypes: {
        null: nullServiceAppt?.row.service_type,
        empty: emptyServiceAppt?.row.service_type,
        whitespace: whitespaceServiceAppt?.row.service_type,
      },
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