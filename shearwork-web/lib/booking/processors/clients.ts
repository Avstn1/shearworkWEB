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

function normalizeName(firstName: string | null, lastName: string | null): string | null {
  const first = firstName?.trim().toLowerCase() || ''
  const last = lastName?.trim().toLowerCase() || ''
  const combined = `${first} ${last}`.trim()
  return combined || null
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

  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  /**
   * Main entry point. Resolves all appointments to canonical client IDs.
   */
  async resolve(appointments: NormalizedAppointment[]): Promise<ClientResolutionResult> {
    // Step 1: Load existing clients into cache
    await this.loadExistingClients()

    // Step 2: Process each appointment
    const appointmentToClient = new Map<string, string>()

    for (const appt of appointments) {
      const clientId = await this.resolveClient(appt)
      if (clientId) {
        appointmentToClient.set(appt.externalId, clientId)
      }
    }

    return {
      appointmentToClient,
      clients: this.clients,
      newClientIds: this.newClientIds,
    }
  }

  /**
   * Upserts all resolved clients to the database.
   */
  async upsert(): Promise<ClientProcessorResult> {
    const upserts = Array.from(this.clients.values()).map((client) => ({
      user_id: this.userId,
      client_id: client.clientId,
      email: client.email,
      phone_normalized: client.phoneNormalized,
      phone: client.phoneNormalized,
      first_name: client.firstName?.toLowerCase() || null,
      last_name: client.lastName?.toLowerCase() || null,
      first_appt: client.firstAppt,
      last_appt: client.lastAppt,
      updated_at: new Date().toISOString(),
    }))

    if (upserts.length > 0) {
      const { error } = await this.supabase
        .from('acuity_clients')
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

  private async loadExistingClients(): Promise<void> {
    const { data: existingClients, error } = await this.supabase
      .from('acuity_clients')
      .select('client_id, email, phone_normalized, first_name, last_name')
      .eq('user_id', this.userId)

    if (error) {
      console.error('Error loading existing clients:', error)
      throw error
    }

    if (!existingClients) return

    for (const client of existingClients) {
      const clientId = client.client_id

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
    }
  }

  private async resolveClient(appt: NormalizedAppointment): Promise<string | null> {
    const email = normalizeEmail(appt.email)
    const phone = normalizePhone(appt.phoneNormalized)
    const firstName = normalizeString(appt.firstName)
    const lastName = normalizeString(appt.lastName)
    const nameKey = normalizeName(firstName, lastName)

    // Skip if no identifiers
    if (!email && !phone && !nameKey) {
      return null
    }

    // Try cache lookup: phone → email → name
    let clientId = this.lookupInCache(phone, email, nameKey)

    if (clientId) {
      // Existing client — update accumulator
      this.updateClient(clientId, appt)
    } else {
      // New client — check database then create if needed
      clientId = await this.findOrCreateClient(appt)
    }

    // Ensure all identifiers point to this client in cache
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

  private updateCache(
    clientId: string,
    phone: string | null,
    email: string | null,
    nameKey: string | null
  ): void {
    if (phone) this.cache.byPhone.set(phone, clientId)
    if (email) this.cache.byEmail.set(email, clientId)
    if (nameKey) this.cache.byName.set(nameKey, clientId)
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
        lastAppt: appt.date,
        firstSource: appt.referralSource,
      }
      this.clients.set(clientId, newClient)
      return
    }

    // Update date range first (needed for isNewest check)
    if (appt.date < existing.firstAppt) existing.firstAppt = appt.date
    if (appt.date > existing.lastAppt) existing.lastAppt = appt.date

    // Only update contact info if this appointment is the newest
    const isNewest = appt.date >= existing.lastAppt

    if (isNewest) {
      if (email) existing.email = email
      if (phone) existing.phoneNormalized = phone
      if (firstName) existing.firstName = firstName
      if (lastName) existing.lastName = lastName
    }

    // First source is always from the earliest appointment
    if (appt.referralSource && !existing.firstSource) {
      existing.firstSource = appt.referralSource
    }
  }

  private async findOrCreateClient(appt: NormalizedAppointment): Promise<string> {
    const email = normalizeEmail(appt.email)
    const phone = normalizePhone(appt.phoneNormalized)
    const firstName = normalizeString(appt.firstName)
    const lastName = normalizeString(appt.lastName)

    const firstNorm = firstName?.toLowerCase() || null
    const lastNorm = lastName?.toLowerCase() || null

    // Try database lookups: phone → email → name
    let existingClientId: string | null = null

    if (phone) {
      const { data } = await this.supabase
        .from('acuity_clients')
        .select('client_id')
        .eq('user_id', this.userId)
        .eq('phone_normalized', phone)
        .limit(1)

      if (data && data.length > 0) {
        existingClientId = data[0].client_id
      }
    }

    if (!existingClientId && email) {
      const { data } = await this.supabase
        .from('acuity_clients')
        .select('client_id')
        .eq('user_id', this.userId)
        .eq('email', email)
        .limit(1)

      if (data && data.length > 0) {
        existingClientId = data[0].client_id
      }
    }

    if (!existingClientId && firstNorm && lastNorm) {
      const { data } = await this.supabase
        .from('acuity_clients')
        .select('client_id')
        .eq('user_id', this.userId)
        .eq('first_name', firstNorm)
        .eq('last_name', lastNorm)
        .limit(1)

      if (data && data.length > 0) {
        existingClientId = data[0].client_id
      }
    }

    if (existingClientId) {
      // Found in DB but wasn't in cache — add to clients map
      this.updateClient(existingClientId, appt)
      return existingClientId
    }

    // Truly new client
    const newClientId = crypto.randomUUID()
    this.newClientIds.add(newClientId)

    const newClient: NormalizedClient = {
      clientId: newClientId,
      email,
      phoneNormalized: phone,
      firstName,
      lastName,
      firstAppt: appt.date,
      lastAppt: appt.date,
      firstSource: appt.referralSource,
    }
    this.clients.set(newClientId, newClient)

    return newClientId
  }
}