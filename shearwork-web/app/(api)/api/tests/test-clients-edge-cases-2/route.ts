// app/api/test-clients-edge-cases-2/route.ts

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

  // ======================== SETUP: Insert existing client for some tests ========================

  const existingClientId = crypto.randomUUID()

  await supabase
    .from('acuity_clients')
    .delete()
    .eq('user_id', user.id)
    .eq('phone_normalized', '+14165550000')

  await supabase
    .from('acuity_clients')
    .insert({
      user_id: user.id,
      client_id: existingClientId,
      email: 'existing@example.com',
      phone_normalized: '+14165550000',
      phone: '+14165550000',
      first_name: 'existing',
      last_name: 'person',
      first_appt: '2024-01-01',
      last_appt: '2024-06-01',
      updated_at: new Date().toISOString(),
    })

  results.setup = { existingClientId }

  // ======================== TEST DATA ========================

  const testAppointments: NormalizedAppointment[] = [
    // -------- TEST 1: Order sensitivity (newer appointment first) --------
    {
      externalId: 'order-test-newer',
      datetime: '2025-01-20T10:00:00',
      date: '2025-01-20',
      email: 'order@example.com',
      phone: '+14165551001',
      phoneNormalized: '+14165551001',
      firstName: 'Order',
      lastName: 'Test',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Google',           // Newer - should NOT be firstSource
    },
    {
      externalId: 'order-test-older',
      datetime: '2025-01-05T10:00:00',
      date: '2025-01-05',
      email: 'order.old@example.com',     // Different email
      phone: '+14165551001',              // Same phone
      phoneNormalized: '+14165551001',
      firstName: 'Order',
      lastName: 'Test',
      serviceType: 'Haircut',
      price: 40,
      tip: 5,
      notes: null,
      referralSource: 'Instagram',        // Older - should BE firstSource
    },

    // -------- TEST 2: Null vs undefined handling --------
    {
      externalId: 'null-test',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'Null',
      lastName: 'Test',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: null,
    },
    {
      externalId: 'undefined-test',
      datetime: '2025-01-11T10:00:00',
      date: '2025-01-11',
      email: undefined as any,
      phone: undefined as any,
      phoneNormalized: undefined as any,
      firstName: 'Undefined',
      lastName: 'Test',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: undefined as any,
    },

    // -------- TEST 3: Hyphenated names --------
    {
      externalId: 'hyphen-test-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'maryjane@example.com',
      phone: null,
      phoneNormalized: null,
      firstName: 'Mary-Jane',
      lastName: 'Watson-Parker',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Instagram',
    },
    {
      externalId: 'hyphen-test-2',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: 'maryjane@example.com',      // Same email - should match
      phone: null,
      phoneNormalized: null,
      firstName: 'Mary Jane',             // Without hyphen
      lastName: 'Watson Parker',          // Without hyphen
      serviceType: 'Color',
      price: 100,
      tip: 20,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 4: Name with suffix --------
    {
      externalId: 'suffix-test-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: null,
      phone: '+14165552001',
      phoneNormalized: '+14165552001',
      firstName: 'John',
      lastName: 'Smith Jr',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Walk-in',
    },
    {
      externalId: 'suffix-test-2',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: null,
      phone: '+14165552001',              // Same phone - should match
      phoneNormalized: '+14165552001',
      firstName: 'John',
      lastName: 'Smith',                  // Without suffix
      serviceType: 'Beard',
      price: 25,
      tip: 5,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 5: Single character names --------
    {
      externalId: 'single-char-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'j.s@example.com',
      phone: null,
      phoneNormalized: null,
      firstName: 'J',
      lastName: 'S',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Referral',
    },
    {
      externalId: 'single-char-2',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: null,
      phone: '+14165553001',
      phoneNormalized: '+14165553001',
      firstName: 'J',                     // Same initials, different person
      lastName: 'S',
      serviceType: 'Buzz',
      price: 30,
      tip: 5,
      notes: null,
      referralSource: 'Instagram',
    },

    // -------- TEST 6: Very long data --------
    {
      externalId: 'long-data-test',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'a'.repeat(100) + '@example.com',    // 112 char email
      phone: '+14165554001',
      phoneNormalized: '+14165554001',
      firstName: 'A'.repeat(100),                  // 100 char first name
      lastName: 'B'.repeat(100),                   // 100 char last name
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'C'.repeat(100),             // 100 char source
    },

    // -------- TEST 7: Shared phone (two different people) --------
    {
      externalId: 'shared-phone-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'dad@example.com',
      phone: '+14165555001',
      phoneNormalized: '+14165555001',
      firstName: 'Dad',
      lastName: 'Family',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Google',
    },
    {
      externalId: 'shared-phone-2',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: 'son@example.com',           // Different email
      phone: '+14165555001',              // Same phone (family phone)
      phoneNormalized: '+14165555001',
      firstName: 'Son',                   // Different name
      lastName: 'Family',
      serviceType: 'Buzz Cut',
      price: 30,
      tip: 5,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 8: Similar but different names (should be separate) --------
    {
      externalId: 'similar-name-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'Jon',
      lastName: 'Smith',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Instagram',
    },
    {
      externalId: 'similar-name-2',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: null,
      phone: null,
      phoneNormalized: null,
      firstName: 'John',                  // Different spelling
      lastName: 'Smith',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Google',
    },

    // -------- TEST 9: Client changes phone, only name matches --------
    {
      externalId: 'phone-change-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: null,
      phone: '+14165556001',
      phoneNormalized: '+14165556001',
      firstName: 'Phone',
      lastName: 'Changer',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'TikTok',
    },
    {
      externalId: 'phone-change-2',
      datetime: '2025-01-20T10:00:00',
      date: '2025-01-20',
      email: null,
      phone: '+14165556002',              // Different phone
      phoneNormalized: '+14165556002',
      firstName: 'Phone',                 // Same name
      lastName: 'Changer',
      serviceType: 'Color',
      price: 100,
      tip: 20,
      notes: null,
      referralSource: null,
    },

    // -------- TEST 10: Mixed case in same batch --------
    {
      externalId: 'mixed-case-1',
      datetime: '2025-01-10T10:00:00',
      date: '2025-01-10',
      email: 'MIXED@EXAMPLE.COM',
      phone: null,
      phoneNormalized: null,
      firstName: 'MIXED',
      lastName: 'CASE',
      serviceType: 'Haircut',
      price: 50,
      tip: 10,
      notes: null,
      referralSource: 'Walk-in',
    },
    {
      externalId: 'mixed-case-2',
      datetime: '2025-01-15T10:00:00',
      date: '2025-01-15',
      email: 'mixed@example.com',         // Same email, different case
      phone: null,
      phoneNormalized: null,
      firstName: 'Mixed',
      lastName: 'Case',
      serviceType: 'Beard',
      price: 25,
      tip: 5,
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

    // TEST 1: Order sensitivity
    const orderGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('order-test-newer') && appts.includes('order-test-older')
    )
    validations['Order: both appointments same client'] = !!orderGroup
    if (orderGroup) {
      const client = resolution.clients.get(orderGroup[0])
      validations['Order: firstSource from older appt (Instagram)'] = client?.firstSource === 'Instagram'
      validations['Order: firstAppt is older date'] = client?.firstAppt === '2025-01-05'
      validations['Order: lastAppt is newer date'] = client?.lastAppt === '2025-01-20'
      validations['Order: email from newer appt'] = client?.email === 'order@example.com'
    }

    // TEST 2: Null vs undefined
    const nullClient = resolution.appointmentToClient.get('null-test')
    const undefinedClient = resolution.appointmentToClient.get('undefined-test')
    validations['Null/undefined: null test resolved'] = !!nullClient
    validations['Null/undefined: undefined test resolved'] = !!undefinedClient
    validations['Null/undefined: are different clients'] = nullClient !== undefinedClient

    // TEST 3: Hyphenated names (should match by email)
    const hyphenGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('hyphen-test-1') && appts.includes('hyphen-test-2')
    )
    validations['Hyphen: matched by email'] = !!hyphenGroup
    if (hyphenGroup) {
      const client = resolution.clients.get(hyphenGroup[0])
      // Name should be from newer appointment (without hyphens)
      validations['Hyphen: name updated to newer'] = client?.firstName === 'Mary Jane'
    }

    // TEST 4: Name with suffix (should match by phone)
    const suffixGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('suffix-test-1') && appts.includes('suffix-test-2')
    )
    validations['Suffix: matched by phone'] = !!suffixGroup
    if (suffixGroup) {
      const client = resolution.clients.get(suffixGroup[0])
      // Name should be from newer appointment (without Jr)
      validations['Suffix: lastName updated to newer'] = client?.lastName === 'Smith'
    }

    // TEST 5: Single character names
    const singleChar1 = resolution.appointmentToClient.get('single-char-1')
    const singleChar2 = resolution.appointmentToClient.get('single-char-2')
    validations['Single char: both resolved'] = !!singleChar1 && !!singleChar2
    // These should be different clients (different email/phone, same initials shouldn't match)
    validations['Single char: are different clients (no false match)'] = singleChar1 !== singleChar2

    // TEST 6: Very long data
    const longDataClient = resolution.appointmentToClient.get('long-data-test')
    validations['Long data: resolved successfully'] = !!longDataClient
    if (longDataClient) {
      const client = resolution.clients.get(longDataClient)
      validations['Long data: email preserved'] = client?.email?.length === 112
      validations['Long data: firstName preserved'] = client?.firstName?.length === 100
      validations['Long data: lastName preserved'] = client?.lastName?.length === 100
    }

    // TEST 7: Shared phone (current behavior: merges them - documenting this)
    const sharedPhoneGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('shared-phone-1') && appts.includes('shared-phone-2')
    )
    // Note: This WILL merge them because phone takes priority. This is expected current behavior.
    validations['Shared phone: merged (expected - phone priority)'] = !!sharedPhoneGroup

    // TEST 8: Similar but different names (should be separate)
    const jonClient = resolution.appointmentToClient.get('similar-name-1')
    const johnClient = resolution.appointmentToClient.get('similar-name-2')
    validations['Similar names: Jon resolved'] = !!jonClient
    validations['Similar names: John resolved'] = !!johnClient
    validations['Similar names: are different clients'] = jonClient !== johnClient

    // TEST 9: Phone change, name matches
    const phoneChangeGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('phone-change-1') && appts.includes('phone-change-2')
    )
    validations['Phone change: matched by name'] = !!phoneChangeGroup
    if (phoneChangeGroup) {
      const client = resolution.clients.get(phoneChangeGroup[0])
      // Should have newer phone
      validations['Phone change: has newer phone'] = client?.phoneNormalized === '+14165556002'
      validations['Phone change: firstSource preserved'] = client?.firstSource === 'TikTok'
    }

    // TEST 10: Mixed case in same batch
    const mixedCaseGroup = Object.entries(clientAppointments).find(([_, appts]) =>
      appts.includes('mixed-case-1') && appts.includes('mixed-case-2')
    )
    validations['Mixed case: both appointments same client'] = !!mixedCaseGroup
    if (mixedCaseGroup) {
      const client = resolution.clients.get(mixedCaseGroup[0])
      validations['Mixed case: email lowercased'] = client?.email === 'mixed@example.com'
    }

    results.validations = validations
    results.allPassed = Object.values(validations).every(v => v)

    // ======================== CLEANUP ========================

    await supabase
      .from('acuity_clients')
      .delete()
      .eq('user_id', user.id)
      .eq('client_id', existingClientId)

    results.cleanup = 'Test client removed'

    return NextResponse.json({ success: true, results })
  } catch (err) {
    await supabase
      .from('acuity_clients')
      .delete()
      .eq('user_id', user.id)
      .eq('client_id', existingClientId)

    return NextResponse.json({
      success: false,
      error: String(err),
      stack: (err as Error).stack,
    }, { status: 500 })
  }
}