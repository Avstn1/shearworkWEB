// // app/api/test-clients-phone-change/route.ts

// import { NextResponse } from 'next/server'
// import { getAuthenticatedUser } from '@/utils/api-auth'
// import { ClientProcessor } from '@/lib/booking/processors/clients'
// import { NormalizedAppointment } from '@/lib/booking/types'

// export async function GET(request: Request) {
//   const { user, supabase } = await getAuthenticatedUser(request)

//   if (!user || !supabase) {
//     return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
//   }

//   // ======================== AGGRESSIVE CLEANUP ========================
  
//   // Delete ALL test clients by various identifiers
//   const testEmails = ['maria@example.com', 'david@example.com']
//   const testPhones = [
//     '+14165551111', '+14165559999',
//     '+14165552222', '+14165558888',
//     '+14165553333', '+14165557777',
//     '+14165554444', '+14165556666',
//     '+14165555555', '+14165550000',
//     '+14165551234', '+14165554321',
//   ]
//   const testNames = [
//     { first: 'juan', last: 'lopez' },
//     { first: 'maria', last: 'garcia' },
//     { first: 'bob', last: '.' },
//     { first: 'carlos', last: null },
//     { first: 'david', last: 'smith' },
//     { first: 'mike', last: 'johnson' },
//   ]

//   // Delete by email
//   for (const email of testEmails) {
//     await supabase
//       .from('acuity_clients')
//       .delete()
//       .eq('user_id', user.id)
//       .eq('email', email)
//   }

//   // Delete by phone
//   for (const phone of testPhones) {
//     await supabase
//       .from('acuity_clients')
//       .delete()
//       .eq('user_id', user.id)
//       .eq('phone_normalized', phone)
//   }

//   // Delete by name
//   for (const name of testNames) {
//     let query = supabase
//       .from('acuity_clients')
//       .delete()
//       .eq('user_id', user.id)
//       .eq('first_name', name.first)
    
//     if (name.last) {
//       query = query.eq('last_name', name.last)
//     } else {
//       query = query.is('last_name', null)
//     }
    
//     await query
//   }

//   // Verify cleanup worked
//   const { data: remainingDavid } = await supabase
//     .from('acuity_clients')
//     .select('client_id, email')
//     .eq('user_id', user.id)
//     .eq('email', 'david@example.com')

//   const cleanupVerification = {
//     davidClientsRemaining: remainingDavid?.length || 0,
//   }


//   // Add after the cleanup section, before test data

//     // Debug: Check what client 0d716083 actually is
//     const { data: mysteryClient } = await supabase
//         .from('acuity_clients')
//         .select('*')
//         .eq('user_id', user.id)
//         .eq('client_id', '0d716083-194b-4cd6-b11e-f528d65fb505')

//     const debugInfo = {
//         davidClientsRemaining: remainingDavid?.length || 0,
//         mysteryClient: mysteryClient?.[0] || null,
//     }

//   // ======================== TEST DATA ========================

//   const testAppointments: NormalizedAppointment[] = [
//     // -------- TEST 1: Phone changes, valid name (should merge via name) --------
//     {
//       externalId: 'phone-change-name-1a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: null,
//       phone: '+14165551111',
//       phoneNormalized: '+14165551111',
//       firstName: 'Juan',
//       lastName: 'Lopez',
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'Instagram',
//     },
//     {
//       externalId: 'phone-change-name-1b',
//       datetime: '2025-01-15T10:00:00',
//       date: '2025-01-15',
//       email: null,
//       phone: '+14165559999',
//       phoneNormalized: '+14165559999',
//       firstName: 'Juan',
//       lastName: 'Lopez',
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: null,
//     },

//     // -------- TEST 2: Phone changes, same email (should merge via email) --------
//     {
//       externalId: 'phone-change-email-2a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: 'maria@example.com',
//       phone: '+14165552222',
//       phoneNormalized: '+14165552222',
//       firstName: 'Maria',
//       lastName: 'Garcia',
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'Google',
//     },
//     {
//       externalId: 'phone-change-email-2b',
//       datetime: '2025-01-20T10:00:00',
//       date: '2025-01-20',
//       email: 'maria@example.com',
//       phone: '+14165558888',
//       phoneNormalized: '+14165558888',
//       firstName: 'Maria',
//       lastName: 'Garcia',
//       serviceType: 'Color',
//       price: 100,
//       tip: 20,
//       notes: null,
//       referralSource: null,
//     },

//     // -------- TEST 3: Phone changes, invalid name, no email (should NOT merge) --------
//     {
//       externalId: 'phone-change-invalid-3a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: null,
//       phone: '+14165553333',
//       phoneNormalized: '+14165553333',
//       firstName: 'Bob',
//       lastName: '.',
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'Walk-in',
//     },
//     {
//       externalId: 'phone-change-invalid-3b',
//       datetime: '2025-01-15T10:00:00',
//       date: '2025-01-15',
//       email: null,
//       phone: '+14165557777',
//       phoneNormalized: '+14165557777',
//       firstName: 'Bob',
//       lastName: '.',
//       serviceType: 'Buzz',
//       price: 30,
//       tip: 5,
//       notes: null,
//       referralSource: 'TikTok',
//     },

//     // -------- TEST 4: Phone changes, first name only (should NOT merge) --------
//     {
//       externalId: 'phone-change-partial-4a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: null,
//       phone: '+14165554444',
//       phoneNormalized: '+14165554444',
//       firstName: 'Carlos',
//       lastName: null,
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'Referral',
//     },
//     {
//       externalId: 'phone-change-partial-4b',
//       datetime: '2025-01-20T10:00:00',
//       date: '2025-01-20',
//       email: null,
//       phone: '+14165556666',
//       phoneNormalized: '+14165556666',
//       firstName: 'Carlos',
//       lastName: null,
//       serviceType: 'Trim',
//       price: 30,
//       tip: 5,
//       notes: null,
//       referralSource: null,
//     },

//     // -------- TEST 5: Phone changes, name AND email match (should merge) --------
//     {
//     externalId: 'phone-change-both-5a',
//     datetime: '2025-01-01T10:00:00',
//     date: '2025-01-01',
//     email: 'david@example.com',
//     phone: '+14165555555',
//     phoneNormalized: '+14165555555',
//     firstName: 'David',
//     lastName: 'Smith',
//     serviceType: 'Haircut',
//     price: 50,
//     tip: 10,
//     notes: null,
//     referralSource: 'Facebook',
//     },
//     {
//     externalId: 'phone-change-both-5b',
//     datetime: '2025-01-25T10:00:00',
//     date: '2025-01-25',
//     email: 'david@example.com',
//     phone: '+14165550099',              // Changed from +14165550000
//     phoneNormalized: '+14165550099',    // Changed from +14165550000
//     firstName: 'David',
//     lastName: 'Smith',
//     serviceType: 'Beard',
//     price: 25,
//     tip: 5,
//     notes: null,
//     referralSource: null,
//     },

//     // -------- TEST 6: Phone changes, valid name case insensitive (should merge) --------
//     {
//       externalId: 'phone-change-case-6a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: null,
//       phone: '+14165551234',
//       phoneNormalized: '+14165551234',
//       firstName: 'MIKE',
//       lastName: 'JOHNSON',
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'TikTok',
//     },
//     {
//       externalId: 'phone-change-case-6b',
//       datetime: '2025-01-20T10:00:00',
//       date: '2025-01-20',
//       email: null,
//       phone: '+14165554321',
//       phoneNormalized: '+14165554321',
//       firstName: 'mike',
//       lastName: 'johnson',
//       serviceType: 'Color',
//       price: 80,
//       tip: 15,
//       notes: null,
//       referralSource: null,
//     },
//   ]

//   // ======================== RUN PROCESSOR ========================

//   try {

//     const { data: potentialMatches } = await supabase
//         .from('acuity_clients')
//         .select('client_id, email, phone_normalized, first_name, last_name')
//         .eq('user_id', user.id)
//         .or('phone_normalized.eq.+14165550000,and(first_name.eq.david,last_name.eq.smith)')

//     const processor = new ClientProcessor(supabase, user.id)
//     const resolution = await processor.resolve(testAppointments)

//     // ======================== ANALYZE RESULTS ========================

//     const clientAppointments: Record<string, string[]> = {}
//     for (const [apptId, clientId] of resolution.appointmentToClient) {
//       if (!clientAppointments[clientId]) clientAppointments[clientId] = []
//       clientAppointments[clientId].push(apptId)
//     }

//     const results: Record<string, any> = {}

//     results.cleanupVerification = cleanupVerification

//     // Add debug info here
//     results.debug = {
//         potentialMatchesForTest5b: potentialMatches
//     }

//     results.summary = {
//       totalAppointments: testAppointments.length,
//       appointmentsResolved: resolution.appointmentToClient.size,
//       uniqueClients: resolution.clients.size,
//     }

//     results.clientGroups = Object.entries(clientAppointments).map(([clientId, apptIds]) => {
//       const client = resolution.clients.get(clientId)
//       return {
//         clientId: clientId.substring(0, 8) + '...',
//         fullClientId: clientId,
//         appointments: apptIds,
//         client: client ? {
//           phone: client.phoneNormalized,
//           email: client.email,
//           firstName: client.firstName,
//           lastName: client.lastName,
//           name: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
//           firstAppt: client.firstAppt,
//           lastAppt: client.lastAppt,
//           firstSource: client.firstSource,
//         } : null,
//       }
//     })

//     // ======================== VALIDATIONS ========================

//     const validations: Record<string, boolean> = {}

//     // TEST 1: Phone changes, valid name — should merge
//     const test1Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('phone-change-name-1a') && appts.includes('phone-change-name-1b')
//     )
//     validations['Test 1: Merged via valid name'] = !!test1Group
//     if (test1Group) {
//       const client = resolution.clients.get(test1Group[0])
//       validations['Test 1: Has newer phone'] = client?.phoneNormalized === '+14165559999'
//       validations['Test 1: firstSource from older appt'] = client?.firstSource === 'Instagram'
//     }

//     // TEST 2: Phone changes, same email — should merge
//     const test2Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('phone-change-email-2a') && appts.includes('phone-change-email-2b')
//     )
//     validations['Test 2: Merged via email'] = !!test2Group
//     if (test2Group) {
//       const client = resolution.clients.get(test2Group[0])
//       validations['Test 2: Has newer phone'] = client?.phoneNormalized === '+14165558888'
//     }

//     // TEST 3: Phone changes, invalid name, no email — should NOT merge
//     const test3Client1 = resolution.appointmentToClient.get('phone-change-invalid-3a')
//     const test3Client2 = resolution.appointmentToClient.get('phone-change-invalid-3b')
//     validations['Test 3: NOT merged (no valid identifier)'] = test3Client1 !== test3Client2
//     validations['Test 3: Both resolved'] = !!test3Client1 && !!test3Client2

//     // TEST 4: Phone changes, first name only — should NOT merge
//     const test4Client1 = resolution.appointmentToClient.get('phone-change-partial-4a')
//     const test4Client2 = resolution.appointmentToClient.get('phone-change-partial-4b')
//     validations['Test 4: NOT merged (partial name)'] = test4Client1 !== test4Client2
//     validations['Test 4: Both resolved'] = !!test4Client1 && !!test4Client2

//     // TEST 5: Phone changes, name AND email match — should merge
//     const test5Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('phone-change-both-5a') && appts.includes('phone-change-both-5b')
//     )
//     validations['Test 5: Merged via email'] = !!test5Group
//     if (test5Group) {
//         const client = resolution.clients.get(test5Group[0])
//         validations['Test 5: Has newer phone'] = client?.phoneNormalized === '+14165550099'  // Updated
//     }

//     // TEST 6: Phone changes, valid name case insensitive — should merge
//     const test6Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('phone-change-case-6a') && appts.includes('phone-change-case-6b')
//     )
//     validations['Test 6: Merged via name (case insensitive)'] = !!test6Group
//     if (test6Group) {
//       const client = resolution.clients.get(test6Group[0])
//       validations['Test 6: Has newer phone'] = client?.phoneNormalized === '+14165554321'
//     }

//     results.validations = validations
//     results.allPassed = Object.values(validations).every(v => v)

//     results.expectedBehavior = {
//       'Phone changes + valid name': 'MERGES via name matching',
//       'Phone changes + same email': 'MERGES via email matching',
//       'Phone changes + invalid name + no email': 'DOES NOT MERGE (no identifier)',
//       'Phone changes + partial name + no email': 'DOES NOT MERGE (name matching requires both parts)',
//       'Phone changes + name AND email': 'MERGES via email (checked before name)',
//       'Phone changes + name case difference': 'MERGES (case insensitive name matching)',
//     }

//     return NextResponse.json({ success: true, results })
//   } catch (err) {
//     return NextResponse.json({
//       success: false,
//       error: String(err),
//       stack: (err as Error).stack,
//     }, { status: 500 })
//   }
// }