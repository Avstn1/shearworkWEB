// // app/api/test-clients-name-quality/route.ts

// import { NextResponse } from 'next/server'
// import { getAuthenticatedUser } from '@/utils/api-auth'
// import { ClientProcessor } from '@/lib/booking/processors/clients'
// import { NormalizedAppointment } from '@/lib/booking/types'

// export async function GET(request: Request) {
//   const { user, supabase } = await getAuthenticatedUser(request)

//   if (!user || !supabase) {
//     return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
//   }

//   // ======================== TEST DATA ========================

//   const testAppointments: NormalizedAppointment[] = [
//     // -------- TEST 1: Good name first, lazy name second (same phone) --------
//     {
//       externalId: 'name-quality-1a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: null,
//       phone: '+14165551111',
//       phoneNormalized: '+14165551111',
//       firstName: 'Juan',
//       lastName: 'Lopez',                  // Valid name
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'Instagram',
//     },
//     {
//       externalId: 'name-quality-1b',
//       datetime: '2025-01-15T10:00:00',
//       date: '2025-01-15',
//       email: null,
//       phone: '+14165551111',              // Same phone
//       phoneNormalized: '+14165551111',
//       firstName: 'Juan',
//       lastName: '.',                      // Lazy entry — should NOT overwrite
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: null,
//     },

//     // -------- TEST 2: Lazy name first, good name second (same phone) --------
//     {
//       externalId: 'name-quality-2a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: null,
//       phone: '+14165552222',
//       phoneNormalized: '+14165552222',
//       firstName: 'Maria',
//       lastName: '.',                      // Lazy entry first
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'Walk-in',
//     },
//     {
//       externalId: 'name-quality-2b',
//       datetime: '2025-01-15T10:00:00',
//       date: '2025-01-15',
//       email: null,
//       phone: '+14165552222',              // Same phone
//       phoneNormalized: '+14165552222',
//       firstName: 'Maria',
//       lastName: 'Garcia',                 // Good name — SHOULD overwrite
//       serviceType: 'Color',
//       price: 100,
//       tip: 20,
//       notes: null,
//       referralSource: null,
//     },

//     // -------- TEST 3: Both lazy names (same phone) --------
//     {
//       externalId: 'name-quality-3a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: null,
//       phone: '+14165553333',
//       phoneNormalized: '+14165553333',
//       firstName: 'Bob',
//       lastName: '.',                      // Lazy
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'TikTok',
//     },
//     {
//       externalId: 'name-quality-3b',
//       datetime: '2025-01-15T10:00:00',
//       date: '2025-01-15',
//       email: null,
//       phone: '+14165553333',              // Same phone
//       phoneNormalized: '+14165553333',
//       firstName: 'Bobby',
//       lastName: 'X',                      // Also lazy — should update since both invalid
//       serviceType: 'Buzz',
//       price: 30,
//       tip: 5,
//       notes: null,
//       referralSource: null,
//     },

//     // -------- TEST 4: Good name, then single char first name --------
//     {
//       externalId: 'name-quality-4a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: 'carlos@example.com',
//       phone: null,
//       phoneNormalized: null,
//       firstName: 'Carlos',
//       lastName: 'Rodriguez',              // Valid
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'Google',
//     },
//     {
//       externalId: 'name-quality-4b',
//       datetime: '2025-01-20T10:00:00',
//       date: '2025-01-20',
//       email: 'carlos@example.com',        // Same email
//       phone: null,
//       phoneNormalized: null,
//       firstName: 'C',                     // Single char — should NOT overwrite
//       lastName: 'Rodriguez',
//       serviceType: 'Beard',
//       price: 25,
//       tip: 5,
//       notes: null,
//       referralSource: null,
//     },

//     // -------- TEST 5: Empty last name vs valid name --------
//     {
//       externalId: 'name-quality-5a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: null,
//       phone: '+14165554444',
//       phoneNormalized: '+14165554444',
//       firstName: 'David',
//       lastName: 'Smith',                  // Valid
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'Referral',
//     },
//     {
//       externalId: 'name-quality-5b',
//       datetime: '2025-01-25T10:00:00',
//       date: '2025-01-25',
//       email: null,
//       phone: '+14165554444',              // Same phone
//       phoneNormalized: '+14165554444',
//       firstName: 'David',
//       lastName: '',                       // Empty — should NOT overwrite
//       serviceType: 'Trim',
//       price: 30,
//       tip: 5,
//       notes: null,
//       referralSource: null,
//     },

//     // -------- TEST 6: Both valid names (newest should win) --------
//     {
//       externalId: 'name-quality-6a',
//       datetime: '2025-01-01T10:00:00',
//       date: '2025-01-01',
//       email: null,
//       phone: '+14165555555',
//       phoneNormalized: '+14165555555',
//       firstName: 'Michael',
//       lastName: 'Johnson',                // Valid
//       serviceType: 'Haircut',
//       price: 50,
//       tip: 10,
//       notes: null,
//       referralSource: 'Instagram',
//     },
//     {
//       externalId: 'name-quality-6b',
//       datetime: '2025-01-20T10:00:00',
//       date: '2025-01-20',
//       email: null,
//       phone: '+14165555555',              // Same phone
//       phoneNormalized: '+14165555555',
//       firstName: 'Mike',
//       lastName: 'Johnson',                // Also valid — should update (nickname)
//       serviceType: 'Color',
//       price: 80,
//       tip: 15,
//       notes: null,
//       referralSource: null,
//     },
//   ]

//   // ======================== RUN PROCESSOR ========================

//   try {
//     const processor = new ClientProcessor(supabase, user.id)
//     const resolution = await processor.resolve(testAppointments)
//     const upsertPayload = processor.getUpsertPayload()

//     // ======================== ANALYZE RESULTS ========================

//     const clientAppointments: Record<string, string[]> = {}
//     for (const [apptId, clientId] of resolution.appointmentToClient) {
//       if (!clientAppointments[clientId]) clientAppointments[clientId] = []
//       clientAppointments[clientId].push(apptId)
//     }

//     const results: Record<string, any> = {}

//     results.summary = {
//       totalAppointments: testAppointments.length,
//       appointmentsResolved: resolution.appointmentToClient.size,
//       uniqueClients: resolution.clients.size,
//     }

//     results.clientGroups = Object.entries(clientAppointments).map(([clientId, apptIds]) => {
//       const client = resolution.clients.get(clientId)
//       return {
//         clientId: clientId.substring(0, 8) + '...',
//         appointments: apptIds,
//         client: client ? {
//           phone: client.phoneNormalized,
//           email: client.email,
//           firstName: client.firstName,
//           lastName: client.lastName,
//           name: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
//         } : null,
//       }
//     })

//     // ======================== VALIDATIONS ========================

//     const validations: Record<string, boolean> = {}

//     // TEST 1: Good name NOT overwritten by lazy name
//     const test1Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('name-quality-1a') && appts.includes('name-quality-1b')
//     )
//     validations['Test 1: Both appointments same client'] = !!test1Group
//     if (test1Group) {
//       const client = resolution.clients.get(test1Group[0])
//       validations['Test 1: Good name "Lopez" preserved (not ".")'] = client?.lastName === 'Lopez'
//     }

//     // TEST 2: Lazy name overwritten by good name
//     const test2Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('name-quality-2a') && appts.includes('name-quality-2b')
//     )
//     validations['Test 2: Both appointments same client'] = !!test2Group
//     if (test2Group) {
//       const client = resolution.clients.get(test2Group[0])
//       validations['Test 2: Good name "Garcia" replaced "."'] = client?.lastName === 'Garcia'
//     }

//     // TEST 3: Both lazy — newest wins
//     const test3Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('name-quality-3a') && appts.includes('name-quality-3b')
//     )
//     validations['Test 3: Both appointments same client'] = !!test3Group
//     if (test3Group) {
//       const client = resolution.clients.get(test3Group[0])
//       validations['Test 3: Newer lazy name used'] = client?.firstName === 'Bobby' && client?.lastName === 'X'
//     }

//     // TEST 4: Valid name not overwritten by single char first name
//     const test4Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('name-quality-4a') && appts.includes('name-quality-4b')
//     )
//     validations['Test 4: Both appointments same client'] = !!test4Group
//     if (test4Group) {
//       const client = resolution.clients.get(test4Group[0])
//       validations['Test 4: Good name "Carlos" preserved (not "C")'] = client?.firstName === 'Carlos'
//     }

//     // TEST 5: Valid name not overwritten by empty last name
//     const test5Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('name-quality-5a') && appts.includes('name-quality-5b')
//     )
//     validations['Test 5: Both appointments same client'] = !!test5Group
//     if (test5Group) {
//       const client = resolution.clients.get(test5Group[0])
//       validations['Test 5: Good name "Smith" preserved (not empty)'] = client?.lastName === 'Smith'
//     }

//     // TEST 6: Both valid — newest wins
//     const test6Group = Object.entries(clientAppointments).find(([_, appts]) =>
//       appts.includes('name-quality-6a') && appts.includes('name-quality-6b')
//     )
//     validations['Test 6: Both appointments same client'] = !!test6Group
//     if (test6Group) {
//       const client = resolution.clients.get(test6Group[0])
//       validations['Test 6: Newer valid name "Mike" used'] = client?.firstName === 'Mike'
//     }

//     results.validations = validations
//     results.allPassed = Object.values(validations).every(v => v)

//     return NextResponse.json({ success: true, results })
//   } catch (err) {
//     return NextResponse.json({
//       success: false,
//       error: String(err),
//       stack: (err as Error).stack,
//     }, { status: 500 })
//   }
// }