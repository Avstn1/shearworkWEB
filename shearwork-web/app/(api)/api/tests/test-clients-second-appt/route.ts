// app/api/tests/test-clients-second-appt/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { ClientProcessor } from '@/lib/booking/processors/clients'
import { NormalizedAppointment } from '@/lib/booking/types'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // ======================== TEST DATA ========================

  const testAppointments: NormalizedAppointment[] = [
    // -------- TEST 1: Single appointment (no secondAppt) --------
    {
      externalId: 'second-appt-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'single@example.com',
      phone: '+14165551001',
      phoneNormalized: '+14165551001',
      firstName: 'Single',
      lastName: 'Visit',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Instagram',
    },

    // -------- TEST 2: Two appointments (secondAppt = lastAppt) --------
    {
      externalId: 'second-appt-2a',
      datetime: '2025-01-01T10:00:00',
      date: '2025-01-01',
      email: 'two@example.com',
      phone: '+14165552002',
      phoneNormalized: '+14165552002',
      firstName: 'Two',
      lastName: 'Visits',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Google',
    },
    {
      externalId: 'second-appt-2b',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: 'two@example.com',
      phone: '+14165552002',
      phoneNormalized: '+14165552002',
      firstName: 'Two',
      lastName: 'Visits',
      serviceType: 'Beard',
      price: 25,
      tip: 5,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 3: Three appointments (all different) --------
    {
      externalId: 'second-appt-3a',
      datetime: '2025-01-01T10:00:00',
      date: '2025-01-01',
      email: 'three@example.com',
      phone: '+14165553003',
      phoneNormalized: '+14165553003',
      firstName: 'Three',
      lastName: 'Visits',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'TikTok',
    },
    {
      externalId: 'second-appt-3b',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'three@example.com',
      phone: '+14165553003',
      phoneNormalized: '+14165553003',
      firstName: 'Three',
      lastName: 'Visits',
      serviceType: 'Color',
      price: 80,
      tip: 15,
      notes: null,
      referralSource: null,
    },
    {
      externalId: 'second-appt-3c',
      datetime: '2025-01-20T10:00:00',
      date: '2025-01-20',
      email: 'three@example.com',
      phone: '+14165553003',
      phoneNormalized: '+14165553003',
      firstName: 'Three',
      lastName: 'Visits',
      serviceType: 'Trim',
      price: 30,
      tip: 5,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 4: Four appointments (secondAppt stays at #2) --------
    {
      externalId: 'second-appt-4a',
      datetime: '2025-01-01T10:00:00',
      date: '2025-01-01',
      email: 'four@example.com',
      phone: '+14165554004',
      phoneNormalized: '+14165554004',
      firstName: 'Four',
      lastName: 'Visits',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Walk-in',
    },
    {
      externalId: 'second-appt-4b',
      datetime: '2025-01-05T10:00:00',
      date: '2025-01-05',
      email: 'four@example.com',
      phone: '+14165554004',
      phoneNormalized: '+14165554004',
      firstName: 'Four',
      lastName: 'Visits',
      serviceType: 'Beard',
      price: 25,
      tip: 5,
      notes: null,
      referralSource: null,
    },
    {
      externalId: 'second-appt-4c',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: 'four@example.com',
      phone: '+14165554004',
      phoneNormalized: '+14165554004',
      firstName: 'Four',
      lastName: 'Visits',
      serviceType: 'Color',
      price: 80,
      tip: 15,
      notes: null,
      referralSource: null,
    },
    {
      externalId: 'second-appt-4d',
      datetime: '2025-01-25T10:00:00',
      date: '2025-01-25',
      email: 'four@example.com',
      phone: '+14165554004',
      phoneNormalized: '+14165554004',
      firstName: 'Four',
      lastName: 'Visits',
      serviceType: 'Trim',
      price: 30,
      tip: 5,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 5: Out of order processing --------
    {
      externalId: 'second-appt-5c',
      datetime: '2025-01-20T10:00:00',
      date: '2025-01-20',
      email: 'outoforder@example.com',
      phone: '+14165555005',
      phoneNormalized: '+14165555005',
      firstName: 'Out',
      lastName: 'Order',
      serviceType: 'Trim',
      price: 30,
      tip: 5,
      notes: null,
      referralSource: null,
    },
    {
      externalId: 'second-appt-5a',
      datetime: '2025-01-01T10:00:00',
      date: '2025-01-01',
      email: 'outoforder@example.com',
      phone: '+14165555005',
      phoneNormalized: '+14165555005',
      firstName: 'Out',
      lastName: 'Order',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Facebook',
    },
    {
      externalId: 'second-appt-5b',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'outoforder@example.com',
      phone: '+14165555005',
      phoneNormalized: '+14165555005',
      firstName: 'Out',
      lastName: 'Order',
      serviceType: 'Color',
      price: 80,
      tip: 15,
      notes: null,
      referralSource: null,
    },
  ]

  // ======================== RUN PROCESSOR ========================

  try {
    const processor = new ClientProcessor(supabase, user.id)
    const resolution = await processor.resolve(testAppointments)
    const upsertPayload = processor.getUpsertPayload()

    // ======================== ANALYZE RESULTS ========================

    const results: Record<string, any> = {}

    results.summary = {
      totalAppointments: testAppointments.length,
      appointmentsResolved: resolution.appointmentToClient.size,
      uniqueClients: resolution.clients.size,
    }

    results.clients = upsertPayload.map(row => ({
      email: row.email,
      firstAppt: row.first_appt,
      secondAppt: row.second_appt,
      lastAppt: row.last_appt,
    }))

    // ======================== VALIDATIONS ========================

    const validations: Record<string, boolean> = {}

    // Find clients by email
    const single = upsertPayload.find(r => r.email === 'single@example.com')
    const two = upsertPayload.find(r => r.email === 'two@example.com')
    const three = upsertPayload.find(r => r.email === 'three@example.com')
    const four = upsertPayload.find(r => r.email === 'four@example.com')
    const outOfOrder = upsertPayload.find(r => r.email === 'outoforder@example.com')

    // TEST 1: Single appointment
    validations['Test 1: Single visit - secondAppt is null'] = single?.second_appt === null
    validations['Test 1: Single visit - firstAppt = lastAppt'] = single?.first_appt === single?.last_appt

    // TEST 2: Two appointments
    validations['Test 2: Two visits - firstAppt correct'] = two?.first_appt === '2025-01-01'
    validations['Test 2: Two visits - secondAppt = lastAppt'] = two?.second_appt === '2025-01-15'
    validations['Test 2: Two visits - lastAppt correct'] = two?.last_appt === '2025-01-15'

    // TEST 3: Three appointments
    validations['Test 3: Three visits - firstAppt correct'] = three?.first_appt === '2025-01-01'
    validations['Test 3: Three visits - secondAppt correct'] = three?.second_appt === '2025-01-10'
    validations['Test 3: Three visits - lastAppt correct'] = three?.last_appt === '2025-01-20'

    // TEST 4: Four appointments
    validations['Test 4: Four visits - firstAppt correct'] = four?.first_appt === '2025-01-01'
    validations['Test 4: Four visits - secondAppt is #2'] = four?.second_appt === '2025-01-05'
    validations['Test 4: Four visits - lastAppt correct'] = four?.last_appt === '2025-01-25'

    // TEST 5: Out of order processing
    validations['Test 5: Out of order - firstAppt correct'] = outOfOrder?.first_appt === '2025-01-01'
    validations['Test 5: Out of order - secondAppt correct'] = outOfOrder?.second_appt === '2025-01-10'
    validations['Test 5: Out of order - lastAppt correct'] = outOfOrder?.last_appt === '2025-01-20'

    results.validations = validations
    results.allPassed = Object.values(validations).every(v => v)

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
      stack: (err as Error).stack,
    }, { status: 500 })
  }
}