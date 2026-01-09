// app/api/test-clients-edge-cases/route.ts

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

  // ======================== SETUP: Insert existing clients with edge case data ========================

  const clientWithWeirdPhone = crypto.randomUUID()
  const clientWithUpperEmail = crypto.randomUUID()
  const clientWithExtraSpaces = crypto.randomUUID()

  // Clean up previous test data
  await supabase
    .from('acuity_clients')
    .delete()
    .eq('user_id', user.id)
    .in('client_id', [clientWithWeirdPhone, clientWithUpperEmail, clientWithExtraSpaces])

  const { error: insertError } = await supabase
    .from('acuity_clients')
    .insert([
      {
        user_id: user.id,
        client_id: clientWithWeirdPhone,
        email: null,
        phone_normalized: '+14165551234',
        phone: '+14165551234',
        first_name: 'phone',
        last_name: 'person',
        first_appt: '2024-06-01',
        last_appt: '2024-12-15',
        updated_at: new Date().toISOString(),
      },
      {
        user_id: user.id,
        client_id: clientWithUpperEmail,
        email: 'uppercase@example.com',    // stored lowercase
        phone_normalized: null,
        phone: null,
        first_name: 'email',
        last_name: 'person',
        first_appt: '2024-06-01',
        last_appt: '2024-12-15',
        updated_at: new Date().toISOString(),
      },
      {
        user_id: user.id,
        client_id: clientWithExtraSpaces,
        email: null,
        phone_normalized: null,
        phone: null,
        first_name: 'space',
        last_name: 'person',
        first_appt: '2024-06-01',
        last_appt: '2024-12-15',
        updated_at: new Date().toISOString(),
      },
    ])

  if (insertError) {
    return NextResponse.json({ error: 'Setup failed', details: insertError }, { status: 500 })
  }

  results.setup = {
    clientWithWeirdPhone,
    clientWithUpperEmail,
    clientWithExtraSpaces,
  }

  // ======================== TEST DATA: Edge Cases ========================

  const testAppointments: NormalizedAppointment[] = [
    // -------- PHONE EDGE CASES --------
    
    // Phone with different formatting (should still match +14165551234)
    {
      externalId: 'edge-phone-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: null,
      phone: '(416) 555-1234',           // Formatted differently
      phoneNormalized: '+14165551234',   // But normalized same
      firstName: 'Phone',
      lastName: 'Person',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // Phone with leading 1 vs without
    {
      externalId: 'edge-phone-2',
      datetime: '2025-01-11T10:00:00',
      date: '2025-01-11',
      email: null,
      phone: '4165551234',               // No country code
      phoneNormalized: '+14165551234',   // Normalized adds it
      firstName: 'Phone',
      lastName: 'Person',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // -------- EMAIL EDGE CASES --------

    // Email with different case
    {
      externalId: 'edge-email-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'UPPERCASE@EXAMPLE.COM',    // All caps
      phone: null,
      phoneNormalized: null,
      firstName: 'Email',
      lastName: 'Person',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // Email with mixed case
    {
      externalId: 'edge-email-2',
      datetime: '2025-01-11T10:00:00',
      date: '2025-01-11',
      email: 'UpperCase@Example.Com',    // Mixed case
      phone: null,
      phoneNormalized: null,
      firstName: 'Email',
      lastName: 'Person',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // -------- NAME EDGE CASES --------

    // Name with extra spaces
    {
      externalId: 'edge-name-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: '  Space  ',            // Extra spaces
      lastName: '  Person  ',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // Name with different case
    {
      externalId: 'edge-name-2',
      datetime: '2025-01-11T10:00:00',
      date: '2025-01-11',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'SPACE',                // All caps
      lastName: 'PERSON',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // Name with tabs and newlines (shouldn't happen but let's be safe)
    {
      externalId: 'edge-name-3',
      datetime: '2025-01-12T10:00:00',
      date: '2025-01-12',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'Space\t',              // Tab character
      lastName: 'Person\n',              // Newline character
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // -------- NULL/EMPTY EDGE CASES --------

    // Empty strings instead of null
    {
      externalId: 'edge-empty-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: '',                         // Empty string
      phone: '',
      phoneNormalized: '',
      firstName: 'Empty',
      lastName: 'Strings',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // Only whitespace
    {
      externalId: 'edge-empty-2',
      datetime: '2025-01-11T10:00:00',
      date: '2025-01-11',
      email: '   ',                      // Only spaces
      phone: '   ',
      phoneNormalized: null,
      firstName: 'Empty',
      lastName: 'Strings',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // -------- PARTIAL IDENTIFIER EDGE CASES --------

    // First name only
    {
      externalId: 'edge-partial-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'OnlyFirst',
      lastName: null,
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // Last name only
    {
      externalId: 'edge-partial-2',
      datetime: '2025-01-11T10:00:00',
      date: '2025-01-11',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: null,
      lastName: 'OnlyLast',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // -------- CROSS-IDENTIFIER MATCHING --------

    // Same person, phone on first visit, email on second (should merge)
    {
      externalId: 'edge-cross-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: null,
      phone: '+14169998888',
      phoneNormalized: '+14169998888',
      firstName: 'Cross',
      lastName: 'Match',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Instagram',
    },
    {
      externalId: 'edge-cross-2',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: 'crossmatch@example.com',
      phone: null,
      phoneNormalized: null,
      firstName: 'Cross',
      lastName: 'Match',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },

    // -------- UNICODE/SPECIAL CHARACTERS --------

    {
      externalId: 'edge-unicode-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'josé@example.com',
      phone: null,
      phoneNormalized: null,
      firstName: 'José',
      lastName: 'García',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },
    {
      externalId: 'edge-unicode-2',
      datetime: '2025-01-11T10:00:00',
      date: '2025-01-11',
      email: 'josé@example.com',         // Same email
      phone: null,
      phoneNormalized: null,
      firstName: 'Jose',                 // Without accent
      lastName: 'Garcia',                // Without accent
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
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
          name: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
          firstAppt: client.firstAppt,
          lastAppt: client.lastAppt,
          firstSource: client.firstSource,
        } : null,
      }
    })

    // ======================== VALIDATIONS ========================

    const validations: Record<string, boolean> = {}

    // Phone edge cases: all should match same existing client
    const phoneClientAppts = clientAppointments[clientWithWeirdPhone] || []
    validations['Phone formatting: (416) 555-1234 matched'] = phoneClientAppts.includes('edge-phone-1')
    validations['Phone formatting: 4165551234 matched'] = phoneClientAppts.includes('edge-phone-2')
    validations['Phone client has 2 appointments'] = phoneClientAppts.length === 2

    // Email edge cases: all should match same existing client
    const emailClientAppts = clientAppointments[clientWithUpperEmail] || []
    validations['Email case: UPPERCASE@EXAMPLE.COM matched'] = emailClientAppts.includes('edge-email-1')
    validations['Email case: UpperCase@Example.Com matched'] = emailClientAppts.includes('edge-email-2')
    validations['Email client has 2 appointments'] = emailClientAppts.length === 2

    // Name edge cases: all should match same existing client
    const nameClientAppts = clientAppointments[clientWithExtraSpaces] || []
    validations['Name spaces: "  Space  " matched'] = nameClientAppts.includes('edge-name-1')
    validations['Name case: "SPACE PERSON" matched'] = nameClientAppts.includes('edge-name-2')
    validations['Name special chars: tab/newline matched'] = nameClientAppts.includes('edge-name-3')
    validations['Name client has 3 appointments'] = nameClientAppts.length === 3

    // Empty string edge cases: should create ONE new client (matched by name)
    const emptyGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('edge-empty-1') && appts.includes('edge-empty-2')
    )
    validations['Empty strings: both appointments same client'] = !!emptyGroup

    // Partial name edge cases: should be separate clients (can't match on partial)
    const partial1Client = resolution.appointmentToClient.get('edge-partial-1')
    const partial2Client = resolution.appointmentToClient.get('edge-partial-2')
    validations['Partial names: first-only resolved'] = !!partial1Client
    validations['Partial names: last-only resolved'] = !!partial2Client
    validations['Partial names: are different clients'] = partial1Client !== partial2Client

    // Cross-identifier: should merge into one client via name
    const crossGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('edge-cross-1') && appts.includes('edge-cross-2')
    )
    validations['Cross-identifier: merged via name'] = !!crossGroup
    if (crossGroup) {
      const crossClient = resolution.clients.get(crossGroup[0])
      validations['Cross-identifier: has phone from first visit'] = crossClient?.phoneNormalized === '+14169998888'
      validations['Cross-identifier: has email from second visit'] = crossClient?.email === 'crossmatch@example.com'
    }

    // Unicode: should match by email (unicode preserved)
    const unicodeGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('edge-unicode-1') && appts.includes('edge-unicode-2')
    )
    validations['Unicode: both appointments same client (matched by email)'] = !!unicodeGroup

    results.validations = validations
    results.allPassed = Object.values(validations).every(v => v)

    // ======================== CLEANUP ========================

    await supabase
      .from('acuity_clients')
      .delete()
      .eq('user_id', user.id)
      .in('client_id', [clientWithWeirdPhone, clientWithUpperEmail, clientWithExtraSpaces])

    results.cleanup = 'Test clients removed'

    return NextResponse.json({ success: true, results })
  } catch (err) {
    await supabase
      .from('acuity_clients')
      .delete()
      .eq('user_id', user.id)
      .in('client_id', [clientWithWeirdPhone, clientWithUpperEmail, clientWithExtraSpaces])

    return NextResponse.json({
      success: false,
      error: String(err),
      stack: (err as Error).stack,
    }, { status: 500 })
  }
}