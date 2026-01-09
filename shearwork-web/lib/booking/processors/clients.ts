// lib/booking/processors/clients.ts

import { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import {
  NormalizedAppointment,
  NormalizedClient,
  ClientResolutionResult,
  ClientProcessorResult,
} from '../types'

// ======================== TYPES ========================

interface ClientCache {
  byPhone: Map<string, string>
  byEmail: Map<string, string>
  byName: Map<string, string>
}

/**
 * Shape of a row to be upserted to acuity_clients table.
 */
export interface ClientUpsertRow {
  user_id: string
  client_id: string
  email: string | null
  phone_normalized: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  first_appt: string
  second_appt: string | null
  last_appt: string
  first_source: string | null
  updated_at: string
  total_appointments: number
}

/**
 * Options for ClientProcessor
 */
export interface ClientProcessorOptions {
  /** Table prefix for testing (e.g., 'test_' uses 'test_acuity_clients') */
  tablePrefix?: string
}

// ======================== NORMALIZATION HELPERS ========================

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

/**
 * Normalizes first + last name into a cache key.
 * Returns null if either name part is less than 2 characters
 * to prevent false matches on initials like "J S".
 */
function normalizeName(firstName: string | null, lastName: string | null): string | null {
  const first = firstName?.trim().toLowerCase() || ''
  const last = lastName?.trim().toLowerCase() || ''

  // Require at least 2 characters each to use name matching
  if (first.length < 2 || last.length < 2) return null

  const combined = `${first} ${last}`.trim()
  return combined || null
}

/**
 * Checks if a name is "valid" (both parts >= 2 characters).
 * Used to prevent overwriting good names with lazy entries like "Juan ."
 */
function isValidName(firstName: string | null, lastName: string | null): boolean {
  return normalizeName(firstName, lastName) !== null
}

/**
 * Updates date tracking (firstAppt, secondAppt, lastAppt) given a new appointment date.
 * Returns updated dates object.
 */
function updateDateTracking(
  currentFirst: string,
  currentSecond: string | null,
  currentLast: string,
  newDate: string
): { firstAppt: string; secondAppt: string | null; lastAppt: string } {
  // Collect all unique dates
  const allDates = new Set([currentFirst, currentSecond, currentLast, newDate].filter(Boolean) as string[])
  
  // Sort chronologically
  const sortedDates = Array.from(allDates).sort()
  
  return {
    firstAppt: sortedDates[0],
    secondAppt: sortedDates.length > 1 ? sortedDates[1] : null,
    lastAppt: sortedDates[sortedDates.length - 1],
  }
}



// ======================== MAIN PROCESSOR ========================

export class ClientProcessor {
  private cache: ClientCache = {
    byPhone: new Map(),
    byEmail: new Map(),
    byName: new Map(),
  }

  private clients: Map<string, NormalizedClient> = new Map()
  private newClientIds: Set<string> = new Set()
  private mergeCount: number = 0
  private tableName: string

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    options: ClientProcessorOptions = {}
  ) {
    const prefix = options.tablePrefix || ''
    this.tableName = `${prefix}acuity_clients`
  }

  // ======================== PUBLIC METHODS ========================

  /**
   * Resolves all appointments to canonical client IDs.
   * Does NOT write to database.
   */
  async resolve(appointments: NormalizedAppointment[]): Promise<ClientResolutionResult> {
    await this.loadExistingClients()

    const appointmentToClient = new Map<string, string>()

    for (const appt of appointments) {
      const clientId = await this.resolveClient(appt)
      if (clientId) {
        appointmentToClient.set(appt.externalId, clientId)
      }
    }

    // Count appointments per client from database
    await this.updateAppointmentCounts()

    return {
      appointmentToClient,
      clients: this.clients,
      newClientIds: this.newClientIds,
    }
  }

  /**
 * Queries acuity_appointments to get total appointment counts per client.
 * Updates the clients map with accurate counts.
 */
  private async updateAppointmentCounts(): Promise<void> {
    const clientIds = Array.from(this.clients.keys())
    
    if (clientIds.length === 0) return

    // Derive appointments table name from clients table name
    const prefix = this.tableName.replace('acuity_clients', '')
    const appointmentsTableName = `${prefix}acuity_appointments`
    
    const counts = new Map<string, number>()
    
    // Batch the query - process 100 client IDs at a time
    const batchSize = 100
    for (let i = 0; i < clientIds.length; i += batchSize) {
      const batch = clientIds.slice(i, i + batchSize)
      
      const { data, error } = await this.supabase
        .from(appointmentsTableName)
        .select('client_id')
        .eq('user_id', this.userId)
        .in('client_id', batch)

      if (error) {
        console.error('Error fetching appointment counts:', error)
        throw error
      }

      // Count appointments per client in this batch
      if (data) {
        for (const row of data) {
          const count = counts.get(row.client_id) || 0
          counts.set(row.client_id, count + 1)
        }
      }
    }

    // Update each client with their count
    for (const [clientId, client] of this.clients) {
      const count = counts.get(clientId) || 0
      ;(client as any).totalAppointments = count
    }
  }

  /**
   * Returns the upsert payload without writing to database.
   * Useful for testing, debugging, and dry runs.
   */
  getUpsertPayload(): ClientUpsertRow[] {
    return Array.from(this.clients.values()).map((client) => ({
      user_id: this.userId,
      client_id: client.clientId,
      email: client.email,
      phone_normalized: client.phoneNormalized,
      phone: client.phoneNormalized,
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

  /**
   * Returns the table name being used (for debugging/testing).
   */
  getTableName(): string {
    return this.tableName
  }

  /**
   * Upserts all resolved clients to the database.
   * Call resolve() first.
   */
  async upsert(): Promise<ClientProcessorResult> {
    const upserts = this.getUpsertPayload()

    if (upserts.length > 0) {
      const { error } = await this.supabase
        .from(this.tableName)
        .upsert(upserts, { onConflict: 'user_id,client_id' })

      if (error) {
        console.error('Client upsert error:', error)
        throw error
      }
    }

    return {
      totalProcessed: this.clients.size,
      newClients: this.newClientIds.size,
      existingClients: this.clients.size - this.newClientIds.size,
      mergedClients: this.mergeCount,
    }
  }

  // ======================== PRIVATE METHODS ========================

  /**
   * Loads existing clients from the database into both:
   * 1. The cache (for identity resolution lookups)
   * 2. The clients map (to preserve historical dates like first_appt, second_appt, last_appt)
   * 
   * This ensures that when we update a client, we merge with their existing data
   * rather than overwriting it with only the current batch's appointments.
   */
  private async loadExistingClients(): Promise<void> {
    const { data: existingClients, error } = await this.supabase
      .from(this.tableName)
      .select('client_id, email, phone_normalized, first_name, last_name, first_appt, second_appt, last_appt, first_source')
      .eq('user_id', this.userId)

    if (error) {
      console.error('Error loading existing clients:', error)
      throw error
    }

    if (!existingClients) return

    for (const client of existingClients) {
      const clientId = client.client_id

      // Populate cache for identity resolution
      if (client.phone_normalized) {
        this.cache.byPhone.set(client.phone_normalized, clientId)
      }

      if (client.email) {
        this.cache.byEmail.set(client.email.toLowerCase(), clientId)
      }

      const nameKey = normalizeName(client.first_name, client.last_name)
      if (nameKey) {
        this.cache.byName.set(nameKey, clientId)
      }

      // Pre-populate clients map with existing data from database
      // This preserves historical dates (first_appt, second_appt, last_appt) when updating
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

  private async resolveClient(appt: NormalizedAppointment): Promise<string | null> {
    const email = normalizeEmail(appt.email)
    const phone = normalizePhone(appt.phoneNormalized)
    const firstName = normalizeString(appt.firstName)
    const lastName = normalizeString(appt.lastName)
    const nameKey = normalizeName(firstName, lastName)

    if (!email && !phone && !nameKey) {
      return null
    }

    let clientId = this.lookupInCache(phone, email, nameKey)

    if (clientId) {
      this.updateClient(clientId, appt)
    } else {
      clientId = await this.findOrCreateClient(appt)
    }

    this.updateCache(clientId, phone, email, nameKey)

    return clientId
  }

  private lookupInCache(
    phone: string | null,
    email: string | null,
    nameKey: string | null
  ): string | null {
    if (phone && this.cache.byPhone.has(phone)) {
      return this.cache.byPhone.get(phone)!
    }
    if (email && this.cache.byEmail.has(email)) {
      return this.cache.byEmail.get(email)!
    }
    if (nameKey && this.cache.byName.has(nameKey)) {
      return this.cache.byName.get(nameKey)!
    }
    return null
  }

  /**
   * Updates the cache with new identifiers.
   * - Phone and email are always updated (stronger identifiers)
   * - Name is only added if not already present (prevents mid-batch merge issues)
   */
  private updateCache(
    clientId: string,
    phone: string | null,
    email: string | null,
    nameKey: string | null
  ): void {
    if (phone) this.cache.byPhone.set(phone, clientId)
    if (email) this.cache.byEmail.set(email, clientId)

    // Only add to name cache if not already present
    // This prevents mid-batch name changes from causing unexpected merges
    if (nameKey && !this.cache.byName.has(nameKey)) {
      this.cache.byName.set(nameKey, clientId)
    }
  }

  /**
   * Updates an existing client with data from a new appointment.
   * 
   * Key behaviors:
   * - Date tracking: Merges new appointment date with existing first/second/last dates
   * - Contact info: Only updates if this appointment is the newest
   * - Name: Only overwrites if new name is valid or existing name is invalid
   * - First source: Keeps the source from the chronologically earliest appointment
   */
  private updateClient(clientId: string, appt: NormalizedAppointment): void {
    const email = normalizeEmail(appt.email)
    const phone = normalizePhone(appt.phoneNormalized)
    const firstName = normalizeString(appt.firstName)
    const lastName = normalizeString(appt.lastName)

    const existing = this.clients.get(clientId)

    if (!existing) {
      // This should only happen for truly NEW clients (not found in DB)
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
      return
    }

    // Update date tracking (firstAppt, secondAppt, lastAppt)
    // This correctly merges the new appointment date with historical dates from DB
    const updatedDates = updateDateTracking(
      existing.firstAppt,
      existing.secondAppt,
      existing.lastAppt,
      appt.date
    )
    existing.firstAppt = updatedDates.firstAppt
    existing.secondAppt = updatedDates.secondAppt
    existing.lastAppt = updatedDates.lastAppt

    // Only update contact info if this appointment is the newest
    const isNewest = appt.date >= existing.lastAppt

    if (isNewest) {
      // Always update email and phone if newer
      if (email) existing.email = email
      if (phone) existing.phoneNormalized = phone

      // Only update name if:
      // 1. New name is valid, OR
      // 2. Existing name is invalid (so any name is better)
      // This prevents "Juan Lopez" from being overwritten by "Juan ."
      const newNameValid = isValidName(firstName, lastName)
      const existingNameValid = isValidName(existing.firstName, existing.lastName)

      if (newNameValid || !existingNameValid) {
        if (firstName) existing.firstName = firstName
        if (lastName) existing.lastName = lastName
      }
    }

    // firstSource should be from chronologically earliest appointment
    if (appt.referralSource) {
      if (!existing.firstSource || appt.date <= existing.firstAppt) {
        existing.firstSource = appt.referralSource
      }
    }
  }

  private async findOrCreateClient(appt: NormalizedAppointment): Promise<string> {
    const email = normalizeEmail(appt.email)
    const phone = normalizePhone(appt.phoneNormalized)
    const firstName = normalizeString(appt.firstName)
    const lastName = normalizeString(appt.lastName)

    const firstNorm = firstName?.toLowerCase() || null
    const lastNorm = lastName?.toLowerCase() || null
    const nameKey = normalizeName(firstName, lastName)

    let existingClientId: string | null = null

    // Try to find existing client by phone (strongest identifier)
    if (phone) {
      const { data } = await this.supabase
        .from(this.tableName)
        .select('client_id')
        .eq('user_id', this.userId)
        .eq('phone_normalized', phone)
        .limit(1)

      if (data && data.length > 0) {
        existingClientId = data[0].client_id
      }
    }

    // Try to find by email if not found by phone
    if (!existingClientId && email) {
      const { data } = await this.supabase
        .from(this.tableName)
        .select('client_id')
        .eq('user_id', this.userId)
        .eq('email', email)
        .limit(1)

      if (data && data.length > 0) {
        existingClientId = data[0].client_id
      }
    }

    // Only match by name if both parts are at least 2 characters
    if (!existingClientId && nameKey && firstNorm && lastNorm) {
      const { data } = await this.supabase
        .from(this.tableName)
        .select('client_id')
        .eq('user_id', this.userId)
        .eq('first_name', firstNorm)
        .eq('last_name', lastNorm)
        .limit(1)

      if (data && data.length > 0) {
        existingClientId = data[0].client_id
      }
    }

    // If we found an existing client, update them and return
    if (existingClientId) {
      // Load full client data if not already in our map
      // (This handles edge case where client exists in DB but wasn't in initial load)
      if (!this.clients.has(existingClientId)) {
        const { data: clientData } = await this.supabase
          .from(this.tableName)
          .select('client_id, email, phone_normalized, first_name, last_name, first_appt, second_appt, last_appt, first_source')
          .eq('user_id', this.userId)
          .eq('client_id', existingClientId)
          .single()

        if (clientData) {
          this.clients.set(existingClientId, {
            clientId: clientData.client_id,
            email: clientData.email,
            phoneNormalized: clientData.phone_normalized,
            firstName: clientData.first_name,
            lastName: clientData.last_name,
            firstAppt: clientData.first_appt,
            secondAppt: clientData.second_appt,
            lastAppt: clientData.last_appt,
            firstSource: clientData.first_source,
          })
        }
      }

      this.updateClient(existingClientId, appt)
      return existingClientId
    }

    // Create new client
    const newClientId = crypto.randomUUID()
    this.newClientIds.add(newClientId)

    const newClient: NormalizedClient = {
      clientId: newClientId,
      email,
      phoneNormalized: phone,
      firstName,
      lastName,
      firstAppt: appt.date,
      secondAppt: null,
      lastAppt: appt.date,
      firstSource: appt.referralSource,
    }
    this.clients.set(newClientId, newClient)

    return newClientId
  }
}