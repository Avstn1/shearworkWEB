// app/api/test-clients/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { ClientProcessor } from '@/lib/booking/processors/clients'
import { NormalizedAppointment } from '@/lib/booking/types'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const results: Record<string, any> = {}

  // ======================== TEST DATA ========================

  const testAppointments: NormalizedAppointment[] = [
    // -------- TEST 1: Basic client with all fields --------
    {
      externalId: 'test-1',
      datetime: '2025-01-01T10:00:00',
      date: '2025-01-01',
      email: 'john@example.com',
      phone: '+14165551234',
      phoneNormalized: '+14165551234',
      firstName: 'John',
      lastName: 'Smith',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Instagram',
    },

    // -------- TEST 2: Same client, different appointment (should merge) --------
    {
      externalId: 'test-2',
      datetime: '2025-01-05T14:00:00',
      date: '2025-01-05',
      email: 'john@example.com',        // Same email
      phone: '+14165551234',
      phoneNormalized: '+14165551234',
      firstName: 'John',
      lastName: 'Smith',
      serviceType: 'Beard Trim',
      price: 25,
      tip: 5,
      notes: null,
      referralSource: 'Google',         // Different source — should keep original
    },

    // -------- TEST 3: Same phone, different email (should match by phone) --------
    {
      externalId: 'test-3',
      datetime: '2025-01-10T11:00:00',
      date: '2025-01-10',
      email: 'johnny@gmail.com',        // Different email
      phone: '+14165551234',
      phoneNormalized: '+14165551234',  // Same phone as John
      firstName: 'Johnny',              // Slightly different name
      lastName: 'Smith',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 4: Same email, no phone (should match by email) --------
    {
      externalId: 'test-4',
      datetime: '2025-01-15T09:00:00',
      date: '2025-01-15',
      email: 'john@example.com',        // Same as TEST 1
      phone: null,
      phoneNormalized: null,            // No phone this time
      firstName: 'John',
      lastName: 'Smith',
      serviceType: 'Haircut',
      price: 50,
      tip: 0,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 5: New client, email only --------
    {
      externalId: 'test-5',
      datetime: '2025-01-02T10:00:00',
      date: '2025-01-02',
      email: 'sarah@example.com',
      phone: null,
      phoneNormalized: null,
      firstName: 'Sarah',
      lastName: 'Connor',
      serviceType: 'Haircut',
      price: 45,
      tip: 10,
      notes: null,
      referralSource: 'TikTok',
    },

    // -------- TEST 6: New client, phone only --------
    {
      externalId: 'test-6',
      datetime: '2025-01-03T15:00:00',
      date: '2025-01-03',
      email: null,
      phone: '+14169999999',
      phoneNormalized: '+14169999999',
      firstName: 'Mike',
      lastName: 'Jones',
      serviceType: 'Buzz Cut',
      price: 30,
      tip: 5,
      notes: null,
      referralSource: 'Walk-in',
    },

    // -------- TEST 7: New client, name only (no email, no phone) --------
    {
      externalId: 'test-7',
      datetime: '2025-01-04T12:00:00',
      date: '2025-01-04',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'Mystery',
      lastName: 'Client',
      serviceType: 'Haircut',
      price: 40,
      tip: 0,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 8: Same name as TEST 7, should match --------
    {
      externalId: 'test-8',
      datetime: '2025-01-20T12:00:00',
      date: '2025-01-20',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'mystery',             // Lowercase — should still match
      lastName: 'CLIENT',               // Uppercase — should still match
      serviceType: 'Beard',
      price: 20,
      tip: 5,
      notes: null,
      referralSource: 'Referral',       // Now has source — should backfill
    },

    // -------- TEST 9: Client with email, later adds phone --------
    {
      externalId: 'test-9',
      datetime: '2025-01-06T10:00:00',
      date: '2025-01-06',
      email: 'alex@example.com',
      phone: null,
      phoneNormalized: null,
      firstName: 'Alex',
      lastName: 'Wilson',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Facebook',
    },

    // -------- TEST 10: Same client adds phone later (match by email) --------
    {
      externalId: 'test-10',
      datetime: '2025-01-25T10:00:00',
      date: '2025-01-25',
      email: 'alex@example.com',        // Same email
      phone: '+14168888888',
      phoneNormalized: '+14168888888',  // Now has phone
      firstName: 'Alex',
      lastName: 'Wilson',
      serviceType: 'Haircut & Beard',
      price: 60,
      tip: 15,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 11: Empty identifiers (should be skipped) --------
    {
      externalId: 'test-11',
      datetime: '2025-01-07T10:00:00',
      date: '2025-01-07',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: null,
      lastName: null,
      serviceType: 'Unknown',
      price: 0,
      tip: 0,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 12: Whitespace in names --------
    {
      externalId: 'test-12',
      datetime: '2025-01-08T10:00:00',
      date: '2025-01-08',
      email: 'bob@example.com',
      phone: null,
      phoneNormalized: null,
      firstName: '  Bob  ',             // Extra spaces
      lastName: '  Marley  ',
      serviceType: 'Dreads',
      price: 100,
      tip: 20,
      notes: null,
      referralSource: 'Referral',
    },

    // -------- TEST 13: Same as TEST 12 without spaces --------
    {
      externalId: 'test-13',
      datetime: '2025-01-28T10:00:00',
      date: '2025-01-28',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'Bob',
      lastName: 'Marley',
      serviceType: 'Trim',
      price: 30,
      tip: 5,
      notes: null,
      referralSource: null,
    },
  ]

  // ======================== RUN PROCESSOR ========================

  try {
    const processor = new ClientProcessor(supabase, user.id)
    const resolution = await processor.resolve(testAppointments)

    // ======================== ANALYZE RESULTS ========================

    // Group appointments by clientId
    const clientAppointments: Record<string, string[]> = {}
    for (const [apptId, clientId] of resolution.appointmentToClient) {
      if (!clientAppointments[clientId]) clientAppointments[clientId] = []
      clientAppointments[clientId].push(apptId)
    }

    // Build test results
    results.summary = {
      totalAppointments: testAppointments.length,
      appointmentsResolved: resolution.appointmentToClient.size,
      uniqueClients: resolution.clients.size,
      newClients: resolution.newClientIds.size,
    }

    results.clientGroups = Object.entries(clientAppointments).map(([clientId, apptIds]) => {
      const client = resolution.clients.get(clientId)
      return {
        clientId: clientId.substring(0, 8) + '...',
        isNew: resolution.newClientIds.has(clientId),
        appointments: apptIds,
        client: client ? {
          email: client.email,
          phone: client.phoneNormalized,
          name: `${client.firstName} ${client.lastName}`,
          firstAppt: client.firstAppt,
          lastAppt: client.lastAppt,
          firstSource: client.firstSource,
        } : null,
      }
    })

    // ======================== EXPECTED RESULTS ========================

    results.expectations = {
      'TEST 1,2,3,4 → Same client (John)': 'Should all map to one clientId via phone/email',
      'TEST 5 → Sarah': 'New client with email',
      'TEST 6 → Mike': 'New client with phone only',
      'TEST 7,8 → Mystery': 'Should match by name (case-insensitive)',
      'TEST 9,10 → Alex': 'Should match by email, phone gets added',
      'TEST 11 → Skipped': 'No identifiers, should not appear',
      'TEST 12,13 → Bob': 'Should match despite whitespace in names',
    }

    // ======================== VALIDATION ========================

    const validations: Record<string, boolean> = {}

    // John should have 4 appointments
    const johnGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('test-1') && appts.includes('test-2') && appts.includes('test-3') && appts.includes('test-4')
    )
    validations['John has 4 appointments'] = !!johnGroup

    // Mystery should have 2 appointments
    const mysteryGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('test-7') && appts.includes('test-8')
    )
    validations['Mystery has 2 appointments'] = !!mysteryGroup

    // Alex should have 2 appointments
    const alexGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('test-9') && appts.includes('test-10')
    )
    validations['Alex has 2 appointments'] = !!alexGroup

    // Bob should have 2 appointments
    const bobGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('test-12') && appts.includes('test-13')
    )
    validations['Bob has 2 appointments'] = !!bobGroup

    // Test 11 should be skipped
    validations['Test 11 skipped (no identifiers)'] = !resolution.appointmentToClient.has('test-11')

    // Should have exactly 6 unique clients: John, Sarah, Mike, Mystery, Alex, Bob
    validations['Exactly 6 unique clients'] = resolution.clients.size === 6

    // John's firstSource should be Instagram (from test-1)
    if (johnGroup) {
      const johnClient = resolution.clients.get(johnGroup[0])
      validations['John firstSource = Instagram'] = johnClient?.firstSource === 'Instagram'
      validations['John firstAppt = 2025-01-01'] = johnClient?.firstAppt === '2025-01-01'
      validations['John lastAppt = 2025-01-15'] = johnClient?.lastAppt === '2025-01-15'
    }

    // Alex should have phone after test-10
    if (alexGroup) {
      const alexClient = resolution.clients.get(alexGroup[0])
      validations['Alex has phone after backfill'] = alexClient?.phoneNormalized === '+14168888888'
    }

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