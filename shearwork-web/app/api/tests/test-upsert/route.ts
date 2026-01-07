// app/api/tests/test-upsert/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { ClientProcessor } from '@/lib/booking/processors/clients'
import { AppointmentProcessor } from '@/lib/booking/processors/appointments'
import { NormalizedAppointment } from '@/lib/booking/types'

const TEST_PREFIX = 'test_'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const results: Record<string, any> = {}
  const validations: Record<string, boolean> = {}

  try {
    // ======================== CLEANUP BEFORE TEST ========================

    await supabase.from(`${TEST_PREFIX}acuity_appointments`).delete().eq('user_id', user.id)
    await supabase.from(`${TEST_PREFIX}acuity_clients`).delete().eq('user_id', user.id)

    results.cleanup = 'Test tables cleared'

    // ======================== TEST DATA ========================

    const testAppointments: NormalizedAppointment[] = [
      // Client 1: Alice - 2 appointments
      {
        externalId: 'upsert-test-001',
        datetime: '2025-01-10T10:00:00',
        date: '2025-01-10',
        email: 'alice.upsert@example.com',
        phone: '+14165550001',
        phoneNormalized: '+14165550001',
        firstName: 'Alice',
        lastName: 'UpsertTest',
        serviceType: 'Haircut',
        price: 50,
        tip: 10,
        notes: 'First visit',
        referralSource: 'Instagram',
      },
      {
        externalId: 'upsert-test-002',
        datetime: '2025-01-20T14:00:00',
        date: '2025-01-20',
        email: 'alice.upsert@example.com',
        phone: '+14165550001',
        phoneNormalized: '+14165550001',
        firstName: 'Alice',
        lastName: 'UpsertTest',
        serviceType: 'Color',
        price: 120,
        tip: 25,
        notes: 'Second visit',
        referralSource: null,
      },

      // Client 2: Bob - 1 appointment
      {
        externalId: 'upsert-test-003',
        datetime: '2025-01-15T11:00:00',
        date: '2025-01-15',
        email: 'bob.upsert@example.com',
        phone: '+14165550002',
        phoneNormalized: '+14165550002',
        firstName: 'Bob',
        lastName: 'UpsertTest',
        serviceType: 'Beard Trim',
        price: 25,
        tip: 5,
        notes: 'Quick trim',
        referralSource: 'Google',
      },

      // Client 3: Charlie - phone only
      {
        externalId: 'upsert-test-004',
        datetime: '2025-01-18T16:00:00',
        date: '2025-01-18',
        email: null,
        phone: '+14165550003',
        phoneNormalized: '+14165550003',
        firstName: 'Charlie',
        lastName: 'PhoneOnly',
        serviceType: 'Buzz Cut',
        price: 30,
        tip: 8,
        notes: null,
        referralSource: 'Walk-in',
      },
    ]

    // ======================== STEP 1: INITIAL UPSERT ========================

    results.step1 = { description: 'Initial upsert - all new records' }

    const clientProcessor1 = new ClientProcessor(supabase, user.id, { tablePrefix: TEST_PREFIX })
    const clientResolution1 = await clientProcessor1.resolve(testAppointments)
    const clientResult1 = await clientProcessor1.upsert()

    results.step1.clientResult = clientResult1
    results.step1.tableName = clientProcessor1.getTableName()

    validations['Step 1: Client table is test_acuity_clients'] = clientProcessor1.getTableName() === 'test_acuity_clients'
    validations['Step 1: 3 clients created'] = clientResult1.totalProcessed === 3
    validations['Step 1: All clients are new'] = clientResult1.newClients === 3

    const appointmentProcessor1 = new AppointmentProcessor(supabase, user.id, { tablePrefix: TEST_PREFIX })
    appointmentProcessor1.process(testAppointments, clientResolution1)
    const appointmentResult1 = await appointmentProcessor1.upsert()

    results.step1.appointmentResult = appointmentResult1
    results.step1.appointmentTableName = appointmentProcessor1.getTableName()

    validations['Step 1: Appointment table is test_acuity_appointments'] = appointmentProcessor1.getTableName() === 'test_acuity_appointments'
    validations['Step 1: 4 appointments processed'] = appointmentResult1.totalProcessed === 4
    validations['Step 1: 4 appointments inserted'] = appointmentResult1.inserted === 4

    // ======================== VERIFY DATA IN DATABASE ========================

    const { data: clients1 } = await supabase
      .from(`${TEST_PREFIX}acuity_clients`)
      .select('*')
      .eq('user_id', user.id)
      .order('email', { ascending: true })

    const { data: appointments1 } = await supabase
      .from(`${TEST_PREFIX}acuity_appointments`)
      .select('*')
      .eq('user_id', user.id)
      .order('acuity_appointment_id', { ascending: true })

    results.step1.dbClients = clients1?.map(c => ({
      email: c.email,
      phone: c.phone_normalized,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      first_appt: c.first_appt,
      second_appt: c.second_appt,
      last_appt: c.last_appt,
      first_source: c.first_source,
    }))

    results.step1.dbAppointments = appointments1?.map(a => ({
      acuity_id: a.acuity_appointment_id,
      date: a.appointment_date,
      service: a.service_type,
      revenue: a.revenue,
      tip: a.tip,
    }))

    // Validate Alice's dates
    const alice1 = clients1?.find(c => c.email === 'alice.upsert@example.com')
    validations['Step 1: Alice first_appt = 2025-01-10'] = alice1?.first_appt === '2025-01-10'
    validations['Step 1: Alice second_appt = 2025-01-20'] = alice1?.second_appt === '2025-01-20'
    validations['Step 1: Alice last_appt = 2025-01-20'] = alice1?.last_appt === '2025-01-20'
    validations['Step 1: Alice first_source = Instagram'] = alice1?.first_source === 'Instagram'

    // Validate Bob (single visit)
    const bob1 = clients1?.find(c => c.email === 'bob.upsert@example.com')
    validations['Step 1: Bob second_appt is null'] = bob1?.second_appt === null

    // Validate appointment revenue/tip
    const appt001 = appointments1?.find(a => a.acuity_appointment_id === 'upsert-test-001')
    validations['Step 1: Appointment 001 revenue = 50'] = appt001?.revenue === 50
    validations['Step 1: Appointment 001 tip = 10'] = appt001?.tip === 10

    // ======================== STEP 2: SIMULATE MANUAL EDIT ========================

    results.step2 = { description: 'Simulate manual edit to revenue' }

    // Manually edit appointment 001's revenue (as if user edited in UI)
    await supabase
      .from(`${TEST_PREFIX}acuity_appointments`)
      .update({ revenue: 75, tip: 15 })  // Changed from 50/10 to 75/15
      .eq('acuity_appointment_id', 'upsert-test-001')
      .eq('user_id', user.id)

    results.step2.manualEdit = 'Changed appointment 001 revenue from 50 to 75, tip from 10 to 15'

    // ======================== STEP 3: RE-UPSERT (should preserve manual edit) ========================

    results.step3 = { description: 'Re-upsert - should preserve manual edits' }

    const clientProcessor3 = new ClientProcessor(supabase, user.id, { tablePrefix: TEST_PREFIX })
    const clientResolution3 = await clientProcessor3.resolve(testAppointments)
    const clientResult3 = await clientProcessor3.upsert()

    results.step3.clientResult = clientResult3

    validations['Step 3: 3 clients processed'] = clientResult3.totalProcessed === 3
    validations['Step 3: 0 new clients'] = clientResult3.newClients === 0
    validations['Step 3: 3 existing clients'] = clientResult3.existingClients === 3

    const appointmentProcessor3 = new AppointmentProcessor(supabase, user.id, { tablePrefix: TEST_PREFIX })
    appointmentProcessor3.process(testAppointments, clientResolution3)
    const appointmentResult3 = await appointmentProcessor3.upsert()

    results.step3.appointmentResult = appointmentResult3

    // Verify manual edit was preserved
    const { data: appointments3 } = await supabase
      .from(`${TEST_PREFIX}acuity_appointments`)
      .select('*')
      .eq('user_id', user.id)
      .order('acuity_appointment_id', { ascending: true })

    const appt001After = appointments3?.find(a => a.acuity_appointment_id === 'upsert-test-001')

    results.step3.appointment001After = {
      revenue: appt001After?.revenue,
      tip: appt001After?.tip,
    }

    validations['Step 3: Manual edit preserved - revenue = 75'] = appt001After?.revenue === 75
    validations['Step 3: Manual edit preserved - tip = 15'] = appt001After?.tip === 15
    validations['Step 3: revenuePreserved count correct'] = appointmentResult3.revenuePreserved > 0

    // ======================== STEP 4: ADD NEW APPOINTMENT TO EXISTING CLIENT ========================

    results.step4 = { description: 'Add new appointment to existing client' }

    const newAppointment: NormalizedAppointment = {
      externalId: 'upsert-test-005',
      datetime: '2025-01-25T10:00:00',
      date: '2025-01-25',
      email: 'alice.upsert@example.com',  // Same client
      phone: '+14165550001',
      phoneNormalized: '+14165550001',
      firstName: 'Alice',
      lastName: 'UpsertTest',
      serviceType: 'Trim',
      price: 35,
      tip: 7,
      notes: 'Third visit',
      referralSource: null,
    }

    const allAppointments = [...testAppointments, newAppointment]

    const clientProcessor4 = new ClientProcessor(supabase, user.id, { tablePrefix: TEST_PREFIX })
    const clientResolution4 = await clientProcessor4.resolve(allAppointments)
    const clientResult4 = await clientProcessor4.upsert()

    results.step4.clientResult = clientResult4

    const appointmentProcessor4 = new AppointmentProcessor(supabase, user.id, { tablePrefix: TEST_PREFIX })
    appointmentProcessor4.process(allAppointments, clientResolution4)
    const appointmentResult4 = await appointmentProcessor4.upsert()

    results.step4.appointmentResult = appointmentResult4

    // Verify Alice now has 3 appointments
    const { data: clients4 } = await supabase
      .from(`${TEST_PREFIX}acuity_clients`)
      .select('*')
      .eq('user_id', user.id)
      .eq('email', 'alice.upsert@example.com')
      .single()

    results.step4.aliceAfter = {
      first_appt: clients4?.first_appt,
      second_appt: clients4?.second_appt,
      last_appt: clients4?.last_appt,
    }

    validations['Step 4: Alice first_appt still = 2025-01-10'] = clients4?.first_appt === '2025-01-10'
    validations['Step 4: Alice second_appt still = 2025-01-20'] = clients4?.second_appt === '2025-01-20'
    validations['Step 4: Alice last_appt updated to 2025-01-25'] = clients4?.last_appt === '2025-01-25'

    // Verify new appointment was added with correct revenue/tip
    const { data: appointments4 } = await supabase
      .from(`${TEST_PREFIX}acuity_appointments`)
      .select('*')
      .eq('user_id', user.id)
      .eq('acuity_appointment_id', 'upsert-test-005')
      .single()

    validations['Step 4: New appointment revenue = 35'] = appointments4?.revenue === 35
    validations['Step 4: New appointment tip = 7'] = appointments4?.tip === 7

    // Verify manual edit still preserved
    const { data: appt001Final } = await supabase
      .from(`${TEST_PREFIX}acuity_appointments`)
      .select('revenue, tip')
      .eq('user_id', user.id)
      .eq('acuity_appointment_id', 'upsert-test-001')
      .single()

    validations['Step 4: Manual edit still preserved - revenue = 75'] = appt001Final?.revenue === 75

    // ======================== STEP 5: VERIFY PRODUCTION TABLES UNTOUCHED ========================

    results.step5 = { description: 'Verify production tables were not modified' }

    const { count: prodClientCount } = await supabase
      .from('acuity_clients')
      .select('*', { count: 'exact', head: true })
      .eq('email', 'alice.upsert@example.com')

    const { count: prodApptCount } = await supabase
      .from('acuity_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('acuity_appointment_id', 'upsert-test-001')

    results.step5.prodClientCount = prodClientCount
    results.step5.prodApptCount = prodApptCount

    validations['Step 5: Production clients table untouched'] = prodClientCount === 0
    validations['Step 5: Production appointments table untouched'] = prodApptCount === 0

    // ======================== FINAL COUNTS ========================

    const { count: testClientCount } = await supabase
      .from(`${TEST_PREFIX}acuity_clients`)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { count: testApptCount } = await supabase
      .from(`${TEST_PREFIX}acuity_appointments`)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    results.finalCounts = {
      testClients: testClientCount,
      testAppointments: testApptCount,
    }

    validations['Final: 3 clients in test table'] = testClientCount === 3
    validations['Final: 5 appointments in test table'] = testApptCount === 5

    // ======================== CLEANUP (optional - comment out to inspect data) ========================

    // await supabase.from(`${TEST_PREFIX}acuity_appointments`).delete().eq('user_id', user.id)
    // await supabase.from(`${TEST_PREFIX}acuity_clients`).delete().eq('user_id', user.id)
    // results.cleanup = 'Test data cleaned up'

    results.cleanup = 'Test data preserved for inspection (manually delete when done)'

    // ======================== SUMMARY ========================

    const totalValidations = Object.keys(validations).length
    const passedValidations = Object.values(validations).filter(v => v).length

    results.validations = validations
    results.validationSummary = {
      total: totalValidations,
      passed: passedValidations,
      failed: totalValidations - passedValidations,
    }
    results.allPassed = passedValidations === totalValidations

    return NextResponse.json({
      success: true,
      note: 'Test used test_acuity_clients and test_acuity_appointments tables',
      results,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
      stack: (err as Error).stack,
      results,
      validations,
    }, { status: 500 })
  }
}