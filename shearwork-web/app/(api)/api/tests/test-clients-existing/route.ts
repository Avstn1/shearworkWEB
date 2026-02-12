// app/api/test-clients-existing/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { ClientProcessor } from '@/lib/booking/processors/clients'
import { NormalizedAppointment } from '@/lib/booking/types'
import crypto from 'crypto'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const results: Record<string, any> = {}

  // ======================== SETUP: Insert existing clients ========================

  const existingClientId = crypto.randomUUID()
  const existingClientId2 = crypto.randomUUID()

  // Clean up any previous test data
  await supabase
    .from('acuity_clients')
    .delete()
    .eq('user_id', user.id)
    .in('email', ['existing@example.com', 'nameonly@example.com'])

  await supabase
    .from('acuity_clients')
    .delete()
    .eq('user_id', user.id)
    .eq('phone_normalized', '+14161111111')

  // Insert "existing" clients that simulate previous pulls
  const { error: insertError } = await supabase
    .from('acuity_clients')
    .insert([
      {
        user_id: user.id,
        client_id: existingClientId,
        email: 'existing@example.com',
        phone_normalized: '+14161111111',
        phone: '+14161111111',
        first_name: 'existing',
        last_name: 'client',
        first_appt: '2024-06-01',
        last_appt: '2024-12-15',
        updated_at: new Date().toISOString(),
      },
      {
        user_id: user.id,
        client_id: existingClientId2,
        email: null,
        phone_normalized: null,
        phone: null,
        first_name: 'namematch',
        last_name: 'person',
        first_appt: '2024-08-01',
        last_appt: '2024-11-01',
        updated_at: new Date().toISOString(),
      },
    ])

  if (insertError) {
    return NextResponse.json({ error: 'Setup failed', details: insertError }, { status: 500 })
  }

  results.setup = {
    existingClientId,
    existingClientId2,
    message: 'Inserted 2 existing clients',
  }

  // ======================== TEST DATA ========================

  const testAppointments: NormalizedAppointment[] = [
    // -------- TEST 1: Match existing client by phone --------
    {
      externalId: 'existing-test-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'newemail@example.com',    // Different email
      phone: '+14161111111',
      phoneNormalized: '+14161111111',  // Same phone as existing client
      firstName: 'Existing',
      lastName: 'Client',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Google',
    },

    // -------- TEST 2: Match existing client by email --------
    {
      externalId: 'existing-test-2',
      datetime: '2025-01-15T14:00:00',
      date: '2025-01-15',
      email: 'existing@example.com',    // Same email as existing client
      phone: null,
      phoneNormalized: null,
      firstName: 'Existing',
      lastName: 'Client',
      serviceType: 'Beard',
      price: 25,
      tip: 5,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 3: Match existing client by name only --------
    {
      externalId: 'existing-test-3',
      datetime: '2025-01-20T11:00:00',
      date: '2025-01-20',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'NameMatch',           // Case different
      lastName: 'PERSON',               // Case different
      serviceType: 'Haircut',
      price: 45,
      tip: 10,
      notes: null,
      referralSource: 'Instagram',
    },

    // -------- TEST 4: Truly new client --------
    {
      externalId: 'existing-test-4',
      datetime: '2025-01-05T09:00:00',
      date: '2025-01-05',
      email: 'brandnew@example.com',
      phone: '+14162222222',
      phoneNormalized: '+14162222222',
      firstName: 'Brand',
      lastName: 'New',
      serviceType: 'Buzz Cut',
      price: 30,
      tip: 5,
      notes: null,
      referralSource: 'TikTok',
    },
  ]

  // ======================== RUN PROCESSOR ========================

  try {
    const processor = new ClientProcessor(supabase, user.id)
    const resolution = await processor.resolve(testAppointments)

    // ======================== ANALYZE RESULTS ========================

    const clientAppointments: Record<string, string[]> = {}
    for (const [apptId, clientId] of resolution.appointmentToClient) {
      if (!clientAppointments[clientId]) clientAppointments[clientId] = []
      clientAppointments[clientId].push(apptId)
    }

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
        fullClientId: clientId,
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

    // ======================== VALIDATIONS ========================

    const validations: Record<string, boolean> = {}

    // Test 1 & 2 should match the same existing client (by phone and email)
    const existingClientAppts = clientAppointments[existingClientId] || []
    validations['Test 1 matched existing client by phone'] = existingClientAppts.includes('existing-test-1')
    validations['Test 2 matched existing client by email'] = existingClientAppts.includes('existing-test-2')
    validations['Existing client has 2 appointments'] = existingClientAppts.length === 2

    // Test 3 should match by name
    const nameMatchAppts = clientAppointments[existingClientId2] || []
    validations['Test 3 matched by name'] = nameMatchAppts.includes('existing-test-3')

    // Test 4 should be new
    const newClientEntry = Object.entries(clientAppointments).find(
      ([_, appts]) => appts.includes('existing-test-4')
    )
    validations['Test 4 is new client'] = newClientEntry ? resolution.newClientIds.has(newClientEntry[0]) : false

    // Existing clients should NOT be in newClientIds
    validations['Existing client not marked as new'] = !resolution.newClientIds.has(existingClientId)
    validations['Name-match client not marked as new'] = !resolution.newClientIds.has(existingClientId2)

    // Should have exactly 3 unique clients (2 existing + 1 new)
    validations['Exactly 3 unique clients'] = resolution.clients.size === 3

    // Only 1 new client
    validations['Only 1 new client'] = resolution.newClientIds.size === 1

    results.validations = validations
    results.allPassed = Object.values(validations).every(v => v)

    // ======================== CLEANUP ========================

    await supabase
      .from('acuity_clients')
      .delete()
      .eq('user_id', user.id)
      .in('client_id', [existingClientId, existingClientId2])

    results.cleanup = 'Test clients removed'

    return NextResponse.json({ success: true, results })
  } catch (err) {
    // Cleanup on error
    await supabase
      .from('acuity_clients')
      .delete()
      .eq('user_id', user.id)
      .in('client_id', [existingClientId, existingClientId2])

    return NextResponse.json({
      success: false,
      error: String(err),
      stack: (err as Error).stack,
    }, { status: 500 })
  }
}