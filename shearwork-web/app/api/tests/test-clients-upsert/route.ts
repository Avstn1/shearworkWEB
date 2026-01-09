// app/api/test-clients-upsert/route.ts

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
    // Client 1: Full info, two appointments
    {
      externalId: 'upsert-test-1',
      datetime: '2025-01-01T10:00:00',
      date: '2025-01-01',
      email: 'Alice@Example.com',       // Should lowercase to 'alice@example.com'
      phone: '+14165551111',
      phoneNormalized: '+14165551111',
      firstName: '  Alice  ',           // Should trim to 'Alice'
      lastName: '  Wonder  ',           // Should trim to 'Wonder'
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Instagram',
    },
    {
      externalId: 'upsert-test-2',
      datetime: '2025-01-15T14:00:00',
      date: '2025-01-15',
      email: 'alice.new@example.com',   // Updated email (newer date)
      phone: '+14165551111',            // Same phone
      phoneNormalized: '+14165551111',
      firstName: 'Alice',
      lastName: 'Wonder',
      serviceType: 'Color',
      price: 100,
      tip: 20,
      notes: null,
      referralSource: 'Google',         // Should NOT replace firstSource
    },

    // Client 2: Email only, empty phone
    {
      externalId: 'upsert-test-3',
      datetime: '2025-01-05T11:00:00',
      date: '2025-01-05',
      email: 'bob@example.com',
      phone: '',                        // Empty string
      phoneNormalized: '',              // Empty string - should become null
      firstName: 'Bob',
      lastName: 'Builder',
      serviceType: 'Buzz Cut',
      price: 30,
      tip: 5,
      notes: null,
      referralSource: 'Walk-in',
    },

    // Client 3: Name only
    {
      externalId: 'upsert-test-4',
      datetime: '2025-01-10T09:00:00',
      date: '2025-01-10',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'Charlie',
      lastName: 'Brown',
      serviceType: 'Trim',
      price: 25,
      tip: 0,
      notes: null,
      referralSource: null,
    },

    // Client 4: Special characters
    {
      externalId: 'upsert-test-5',
      datetime: '2025-01-12T10:00:00',
      date: '2025-01-12',
      email: 'josé@example.com',
      phone: null,
      phoneNormalized: null,
      firstName: 'José',
      lastName: 'García',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Referral',
    },
  ]

  // ======================== RUN PROCESSOR ========================

  try {
    const processor = new ClientProcessor(supabase, user.id)
    const resolution = await processor.resolve(testAppointments)

    // Get upsert payload WITHOUT actually upserting
    const upsertPayload = processor.getUpsertPayload()

    // ======================== VALIDATIONS ========================

    const validations: Record<string, boolean> = {}

    // Should have 4 unique clients
    validations['4 unique clients'] = upsertPayload.length === 4

    // Find Alice's record
    const alice = upsertPayload.find(row => row.phone_normalized === '+14165551111')
    if (alice) {
      validations['Alice: email lowercase'] = alice.email === 'alice.new@example.com'
      validations['Alice: first_name lowercase'] = alice.first_name === 'alice'
      validations['Alice: last_name lowercase'] = alice.last_name === 'wonder'
      validations['Alice: first_appt correct'] = alice.first_appt === '2025-01-01'
      validations['Alice: last_appt correct'] = alice.last_appt === '2025-01-15'
      validations['Alice: user_id set'] = alice.user_id === user.id
      validations['Alice: client_id is UUID'] = /^[0-9a-f-]{36}$/.test(alice.client_id)
    } else {
      validations['Alice: found'] = false
    }

    // Find Bob's record
    const bob = upsertPayload.find(row => row.email === 'bob@example.com')
    if (bob) {
      validations['Bob: phone_normalized is null (not empty string)'] = bob.phone_normalized === null
      validations['Bob: phone is null (not empty string)'] = bob.phone === null
    } else {
      validations['Bob: found'] = false
    }

    // Find Charlie's record (name only)
    const charlie = upsertPayload.find(row => row.first_name === 'charlie' && row.last_name === 'brown')
    if (charlie) {
      validations['Charlie: email is null'] = charlie.email === null
      validations['Charlie: phone is null'] = charlie.phone === null
    } else {
      validations['Charlie: found'] = false
    }

    // Find José's record
    const jose = upsertPayload.find(row => row.email === 'josé@example.com')
    if (jose) {
      validations['José: unicode email preserved'] = jose.email === 'josé@example.com'
      validations['José: unicode name stored lowercase'] = jose.first_name === 'josé' && jose.last_name === 'garcía'
    } else {
      validations['José: found'] = false
    }

    // All records should have updated_at
    validations['All records have updated_at'] = upsertPayload.every(row => 
    row.updated_at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(row.updated_at)
    )

    const results = {
      summary: {
        totalAppointments: testAppointments.length,
        appointmentsResolved: resolution.appointmentToClient.size,
        uniqueClients: resolution.clients.size,
        newClients: resolution.newClientIds.size,
        upsertRowCount: upsertPayload.length,
      },
      upsertPayload,
      validations,
      allPassed: Object.values(validations).every(v => v),
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
      stack: (err as Error).stack,
    }, { status: 500 })
  }
}