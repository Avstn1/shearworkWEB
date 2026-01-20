import { SupabaseClient } from '@supabase/supabase-js'
import {
  NormalizedAppointment,
  NormalizedClient,
  ClientResolutionResult,
  ClientProcessorResult,
} from '../types'

interface SquareClientUpsertRow {
  user_id: string
  merchant_id: string
  customer_id: string
  email: string | null
  phone: string | null
  phone_normalized: string | null
  first_name: string | null
  last_name: string | null
  first_appt: string
  second_appt: string | null
  last_appt: string
  first_source: string | null
  total_appointments: number
  updated_at: string
}

interface SquareClientProcessorOptions {
  tablePrefix?: string
  merchantId?: string
}

function normalizeEmail(email: string | null | undefined): string | null {
  const cleaned = email?.trim().toLowerCase()
  return cleaned || null
}

function normalizePhone(phone: string | null | undefined): string | null {
  const cleaned = phone?.trim()
  return cleaned || null
}

function normalizeString(value: string | null | undefined): string | null {
  const cleaned = value?.trim()
  return cleaned || null
}

function normalizeName(firstName: string | null, lastName: string | null): string | null {
  const first = firstName?.trim().toLowerCase() || ''
  const last = lastName?.trim().toLowerCase() || ''
  if (first.length < 2 || last.length < 2) return null
  return `${first} ${last}`.trim() || null
}

function isValidName(firstName: string | null, lastName: string | null): boolean {
  return normalizeName(firstName, lastName) !== null
}

function updateDateTracking(
  currentFirst: string,
  currentSecond: string | null,
  currentLast: string,
  newDate: string
): { firstAppt: string; secondAppt: string | null; lastAppt: string } {
  const allDates = new Set([currentFirst, currentSecond, currentLast, newDate].filter(Boolean) as string[])
  const sortedDates = Array.from(allDates).sort()

  return {
    firstAppt: sortedDates[0],
    secondAppt: sortedDates.length > 1 ? sortedDates[1] : null,
    lastAppt: sortedDates[sortedDates.length - 1],
  }
}

export class SquareClientProcessor {
  private clients: Map<string, NormalizedClient> = new Map()
  private newClientIds: Set<string> = new Set()
  private tableName: string
  private appointmentsTable: string
  private merchantId: string

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    options: SquareClientProcessorOptions = {}
  ) {
    const prefix = options.tablePrefix || ''
    this.tableName = `${prefix}square_clients`
    this.appointmentsTable = `${prefix}square_appointments`
    this.merchantId = options.merchantId || 'unknown'
  }

  async resolve(appointments: NormalizedAppointment[]): Promise<ClientResolutionResult> {
    await this.loadExistingClients()

    const appointmentToClient = new Map<string, string>()

    for (const appt of appointments) {
      const customerId = appt.customerId
      if (!customerId) continue

      appointmentToClient.set(appt.externalId, customerId)
      this.updateClient(customerId, appt)
    }

    await this.updateAppointmentCounts()

    return {
      appointmentToClient,
      clients: this.clients,
      newClientIds: this.newClientIds,
    }
  }

  getUpsertPayload(): SquareClientUpsertRow[] {
    return Array.from(this.clients.values()).map((client) => ({
      user_id: this.userId,
      merchant_id: this.merchantId,
      customer_id: client.clientId,
      email: client.email,
      phone: client.phoneNormalized,
      phone_normalized: client.phoneNormalized,
      first_name: client.firstName?.toLowerCase() || null,
      last_name: client.lastName?.toLowerCase() || null,
      first_appt: client.firstAppt,
      second_appt: client.secondAppt,
      last_appt: client.lastAppt,
      first_source: client.firstSource,
      total_appointments: (client as any).totalAppointments || 0,
      updated_at: new Date().toISOString(),
    }))
  }

  async upsert(): Promise<ClientProcessorResult> {
    const upserts = this.getUpsertPayload()

    if (upserts.length > 0) {
      const { error } = await this.supabase
        .from(this.tableName)
        .upsert(upserts, { onConflict: 'user_id,customer_id' })

      if (error) {
        console.error('Square client upsert error:', error)
        throw error
      }
    }

    return {
      totalProcessed: this.clients.size,
      newClients: this.newClientIds.size,
      existingClients: this.clients.size - this.newClientIds.size,
      mergedClients: 0,
    }
  }

  private async loadExistingClients(): Promise<void> {
    const { data: existingClients, error } = await this.supabase
      .from(this.tableName)
      .select('customer_id, email, phone_normalized, first_name, last_name, first_appt, second_appt, last_appt, first_source')
      .eq('user_id', this.userId)

    if (error) {
      console.error('Error loading square clients:', error)
      throw error
    }

    if (!existingClients) return

    for (const client of existingClients) {
      const clientId = client.customer_id

      this.clients.set(clientId, {
        clientId,
        email: client.email,
        phoneNormalized: client.phone_normalized,
        firstName: client.first_name,
        lastName: client.last_name,
        firstAppt: client.first_appt,
        secondAppt: client.second_appt,
        lastAppt: client.last_appt,
        firstSource: client.first_source,
      })
    }
  }

  private async updateAppointmentCounts(): Promise<void> {
    const clientIds = Array.from(this.clients.keys())
    if (clientIds.length === 0) return

    const counts = new Map<string, number>()
    const batchSize = 100

    for (let i = 0; i < clientIds.length; i += batchSize) {
      const batch = clientIds.slice(i, i + batchSize)

      const { data, error } = await this.supabase
        .from(this.appointmentsTable)
        .select('customer_id')
        .eq('user_id', this.userId)
        .in('customer_id', batch)

      if (error) {
        console.error('Error fetching square appointment counts:', error)
        throw error
      }

      if (data) {
        for (const row of data) {
          const count = counts.get(row.customer_id) || 0
          counts.set(row.customer_id, count + 1)
        }
      }
    }

    for (const [clientId, client] of this.clients) {
      const count = counts.get(clientId) || 0
      ;(client as any).totalAppointments = count
    }
  }

  private updateClient(clientId: string, appt: NormalizedAppointment): void {
    const email = normalizeEmail(appt.email)
    const phone = normalizePhone(appt.phoneNormalized)
    const firstName = normalizeString(appt.firstName)
    const lastName = normalizeString(appt.lastName)

    const existing = this.clients.get(clientId)

    if (!existing) {
      const newClient: NormalizedClient = {
        clientId,
        email,
        phoneNormalized: phone,
        firstName,
        lastName,
        firstAppt: appt.date,
        secondAppt: null,
        lastAppt: appt.date,
        firstSource: appt.referralSource,
      }
      this.clients.set(clientId, newClient)
      this.newClientIds.add(clientId)
      return
    }

    const updatedDates = updateDateTracking(
      existing.firstAppt,
      existing.secondAppt,
      existing.lastAppt,
      appt.date
    )
    existing.firstAppt = updatedDates.firstAppt
    existing.secondAppt = updatedDates.secondAppt
    existing.lastAppt = updatedDates.lastAppt

    const isNewest = appt.date >= existing.lastAppt

    if (isNewest) {
      if (email) existing.email = email
      if (phone) existing.phoneNormalized = phone

      const newNameValid = isValidName(firstName, lastName)
      const existingNameValid = isValidName(existing.firstName, existing.lastName)

      if (newNameValid || !existingNameValid) {
        if (firstName) existing.firstName = firstName
        if (lastName) existing.lastName = lastName
      }
    }

    if (appt.referralSource) {
      if (!existing.firstSource || appt.date <= existing.firstAppt) {
        existing.firstSource = appt.referralSource
      }
    }
  }
}
