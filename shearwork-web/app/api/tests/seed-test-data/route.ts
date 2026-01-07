// app/api/tests/seed-test-data/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import crypto from 'crypto'

const TEST_PREFIX = 'test_'

/**
 * Seeds test tables with diverse dummy data for aggregation testing.
 * 
 * Creates a realistic dataset spanning multiple months with:
 * - New customers each month
 * - Returning customers with varying retention
 * - Different referral sources
 * - Various service types and price points
 * - Realistic revenue and tip patterns
 * 
 * Query parameters:
 * - clear: boolean (if true, clears existing test data first)
 * 
 * Usage:
 * GET /api/tests/seed-test-data
 * GET /api/tests/seed-test-data?clear=true
 */
export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clear = searchParams.get('clear') === 'true'

  const results: Record<string, any> = {}

  try {
    // ======================== CLEAR EXISTING DATA ========================

    if (clear) {
      await supabase.from(`${TEST_PREFIX}acuity_appointments`).delete().eq('user_id', user.id)
      await supabase.from(`${TEST_PREFIX}acuity_clients`).delete().eq('user_id', user.id)
      results.cleared = true
    }

    // ======================== CONFIGURATION ========================

    const services = [
      { name: 'Haircut', price: 45 },
      { name: 'Haircut & Beard', price: 55 },
      { name: 'Beard Trim', price: 25 },
      { name: 'Kids Haircut', price: 35 },
      { name: 'Head Shave', price: 35 },
      { name: 'Lineup', price: 25 },
      { name: 'Color', price: 80 },
      { name: 'Haircut + Eyebrow', price: 51 },
    ]

    const sources = [
      { name: 'Instagram', weight: 20 },
      { name: 'Google', weight: 15 },
      { name: 'Referral', weight: 15 },
      { name: 'Walk-in', weight: 10 },
      { name: 'TikTok', weight: 8 },
      { name: 'Returning Client', weight: 7 },
      { name: null, weight: 25 },  // 25% leave it blank
    ]

    const firstNames = [
      'James', 'Michael', 'David', 'Chris', 'Daniel', 'Matthew', 'Anthony', 'Joshua',
      'Andrew', 'Ryan', 'Brandon', 'Jason', 'Justin', 'Kevin', 'Brian', 'Eric',
      'Marcus', 'Andre', 'Carlos', 'Diego', 'Luis', 'Miguel', 'Jose', 'Juan',
      'Alex', 'Tyler', 'Jordan', 'Kyle', 'Aaron', 'Nathan', 'Omar', 'Malik',
      'Jamal', 'Darius', 'Terrence', 'Isaiah', 'Elijah', 'Noah', 'Liam', 'Mason'
    ]

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
      'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
      'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall', 'Young', 'King'
    ]

    // ======================== GENERATE CLIENTS ========================

    interface GeneratedClient {
      clientId: string
      email: string | null
      phone: string
      firstName: string
      lastName: string
      firstSource: string | null
      // Behavior patterns
      isLoyal: boolean        // Will they return?
      visitFrequency: number  // Days between visits (if loyal)
      preferredService: typeof services[number]
      tipPercent: number      // 0, 10, 15, 20, 25
    }

    const clients: GeneratedClient[] = []

    // Generate 150 unique clients with different behavior patterns
    for (let i = 0; i < 150; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      const hasEmail = Math.random() > 0.3 // 70% have email

      // Determine loyalty (60% will return at least once)
      const isLoyal = Math.random() < 0.6

      // Visit frequency: loyal customers come every 14-45 days
      const visitFrequency = isLoyal ? Math.floor(Math.random() * 31) + 14 : 999

      clients.push({
        clientId: crypto.randomUUID(),
        email: hasEmail ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com` : null,
        phone: `+1416555${String(1000 + i).padStart(4, '0')}`,
        firstName,
        lastName,
        firstSource: weightedRandom(sources),
        isLoyal,
        visitFrequency,
        preferredService: services[Math.floor(Math.random() * services.length)],
        tipPercent: [0, 0, 10, 15, 15, 20, 20, 20, 25][Math.floor(Math.random() * 9)],
      })
    }

    // ======================== GENERATE APPOINTMENTS ========================

    interface GeneratedAppointment {
      externalId: string
      clientId: string
      date: string
      datetime: string
      serviceType: string
      revenue: number
      tip: number
      phone: string
    }

    const appointments: GeneratedAppointment[] = []
    let appointmentIdCounter = 9000000

    // Generate appointments from Oct 2024 to Jan 2025 (4 months)
    const months = [
      { year: 2024, month: 9, name: 'October', newClients: 40 },
      { year: 2024, month: 10, name: 'November', newClients: 35 },
      { year: 2024, month: 11, name: 'December', newClients: 45 },  // Holiday bump
      { year: 2025, month: 0, name: 'January', newClients: 30 },
    ]

    // Track when each client first visited and their visit history
    const clientFirstVisit: Map<string, string> = new Map()
    const clientVisits: Map<string, string[]> = new Map()

    let clientIndex = 0

    for (const monthConfig of months) {
      const { year, month, newClients } = monthConfig
      const daysInMonth = new Date(year, month + 1, 0).getDate()

      // Add new clients for this month
      const monthNewClients = clients.slice(clientIndex, clientIndex + newClients)
      clientIndex += newClients

      // Generate first visits for new clients
      for (const client of monthNewClients) {
        const day = Math.floor(Math.random() * daysInMonth) + 1
        const hour = Math.floor(Math.random() * 10) + 9 // 9 AM to 7 PM
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const datetime = `${date}T${String(hour).padStart(2, '0')}:00:00`

        const service = client.preferredService
        const tip = Math.round(service.price * client.tipPercent / 100)

        appointments.push({
          externalId: String(appointmentIdCounter++),
          clientId: client.clientId,
          date,
          datetime,
          serviceType: service.name,
          revenue: service.price,
          tip,
          phone: client.phone,
        })

        clientFirstVisit.set(client.clientId, date)
        clientVisits.set(client.clientId, [date])
      }

      // Generate return visits for existing loyal clients
      for (const [existingClientId, visits] of clientVisits) {
        const client = clients.find(c => c.clientId === existingClientId)
        if (!client || !client.isLoyal) continue

        const lastVisit = visits[visits.length - 1]
        const lastVisitDate = new Date(lastVisit)

        // Check if they're due for a return visit this month
        const nextVisitDate = new Date(lastVisitDate)
        nextVisitDate.setDate(nextVisitDate.getDate() + client.visitFrequency + Math.floor(Math.random() * 7) - 3)

        // If next visit falls in this month, add it
        if (nextVisitDate.getFullYear() === year && nextVisitDate.getMonth() === month) {
          const day = nextVisitDate.getDate()
          if (day <= daysInMonth) {
            const hour = Math.floor(Math.random() * 10) + 9
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const datetime = `${date}T${String(hour).padStart(2, '0')}:00:00`

            // Sometimes they try a different service
            const service = Math.random() > 0.8 
              ? services[Math.floor(Math.random() * services.length)]
              : client.preferredService
            const tip = Math.round(service.price * client.tipPercent / 100)

            appointments.push({
              externalId: String(appointmentIdCounter++),
              clientId: client.clientId,
              date,
              datetime,
              serviceType: service.name,
              revenue: service.price,
              tip,
              phone: client.phone,
            })

            visits.push(date)
          }
        }
      }
    }

    // ======================== BUILD CLIENT RECORDS ========================

    const clientRecords = clients.slice(0, clientIndex).map(client => {
      const visits = clientVisits.get(client.clientId) || []
      const sortedVisits = [...visits].sort()

      return {
        user_id: user.id,
        client_id: client.clientId,
        email: client.email,
        phone: client.phone,
        phone_normalized: client.phone,
        first_name: client.firstName.toLowerCase(),
        last_name: client.lastName.toLowerCase(),
        first_appt: sortedVisits[0] || null,
        second_appt: sortedVisits[1] || null,
        last_appt: sortedVisits[sortedVisits.length - 1] || null,
        first_source: client.firstSource,
        updated_at: new Date().toISOString(),
      }
    })

    // ======================== BUILD APPOINTMENT RECORDS ========================

    const appointmentRecords = appointments.map(appt => ({
      user_id: user.id,
      acuity_appointment_id: appt.externalId,
      client_id: appt.clientId,
      phone_normalized: appt.phone,
      appointment_date: appt.date,
      datetime: appt.datetime,
      service_type: appt.serviceType,
      revenue: appt.revenue,
      tip: appt.tip,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // ======================== INSERT DATA ========================

    // Insert clients
    const { error: clientError } = await supabase
      .from(`${TEST_PREFIX}acuity_clients`)
      .upsert(clientRecords, { onConflict: 'user_id,client_id' })

    if (clientError) throw clientError

    // Insert appointments in batches
    const batchSize = 100
    for (let i = 0; i < appointmentRecords.length; i += batchSize) {
      const batch = appointmentRecords.slice(i, i + batchSize)
      const { error: apptError } = await supabase
        .from(`${TEST_PREFIX}acuity_appointments`)
        .upsert(batch, { onConflict: 'user_id,acuity_appointment_id' })

      if (apptError) throw apptError
    }

    // ======================== CALCULATE STATS ========================

    const stats = {
      totalClients: clientRecords.length,
      totalAppointments: appointmentRecords.length,
      clientsWithSecondAppt: clientRecords.filter(c => c.second_appt).length,
      retentionRate: Math.round(clientRecords.filter(c => c.second_appt).length / clientRecords.length * 100),
    }

    // Breakdown by month
    const monthlyBreakdown: Record<string, { appointments: number; revenue: number; tips: number; newClients: number }> = {}
    
    for (const appt of appointmentRecords) {
      const month = appt.appointment_date.substring(0, 7) // YYYY-MM
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = { appointments: 0, revenue: 0, tips: 0, newClients: 0 }
      }
      monthlyBreakdown[month].appointments++
      monthlyBreakdown[month].revenue += appt.revenue
      monthlyBreakdown[month].tips += appt.tip
    }

    for (const client of clientRecords) {
      if (client.first_appt) {
        const month = client.first_appt.substring(0, 7)
        if (monthlyBreakdown[month]) {
          monthlyBreakdown[month].newClients++
        }
      }
    }

    // Breakdown by source
    const sourceBreakdown: Record<string, { total: number; returned: number; retentionRate: number }> = {}
    
    for (const client of clientRecords) {
      const source = client.first_source || 'Unknown'
      if (!sourceBreakdown[source]) {
        sourceBreakdown[source] = { total: 0, returned: 0, retentionRate: 0 }
      }
      sourceBreakdown[source].total++
      if (client.second_appt) {
        sourceBreakdown[source].returned++
      }
    }

    for (const source of Object.keys(sourceBreakdown)) {
      const s = sourceBreakdown[source]
      s.retentionRate = Math.round(s.returned / s.total * 100)
    }

    // Service breakdown
    const serviceBreakdown: Record<string, { count: number; revenue: number; tips: number }> = {}
    
    for (const appt of appointmentRecords) {
      const service = appt.service_type || 'Unknown'
      if (!serviceBreakdown[service]) {
        serviceBreakdown[service] = { count: 0, revenue: 0, tips: 0 }
      }
      serviceBreakdown[service].count++
      serviceBreakdown[service].revenue += appt.revenue
      serviceBreakdown[service].tips += appt.tip
    }

    results.stats = stats
    results.monthlyBreakdown = monthlyBreakdown
    results.sourceBreakdown = sourceBreakdown
    results.serviceBreakdown = serviceBreakdown

    // Sample data
    results.sampleClients = clientRecords.slice(0, 5).map(c => ({
      name: `${c.first_name} ${c.last_name}`,
      email: c.email,
      first_appt: c.first_appt,
      second_appt: c.second_appt,
      last_appt: c.last_appt,
      first_source: c.first_source,
    }))

    results.sampleAppointments = appointmentRecords.slice(0, 5).map(a => ({
      date: a.appointment_date,
      service: a.service_type,
      revenue: a.revenue,
      tip: a.tip,
    }))

    return NextResponse.json({
      success: true,
      message: 'Test data seeded successfully',
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

// Helper: weighted random selection
function weightedRandom(items: { name: string | null; weight: number }[]): string | null {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight

  for (const item of items) {
    random -= item.weight
    if (random <= 0) {
      return item.name
    }
  }

  return items[0].name
}