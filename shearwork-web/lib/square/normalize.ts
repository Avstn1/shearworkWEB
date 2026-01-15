import { NormalizedAppointment } from '@/lib/booking/types'

export interface SquarePaymentRecord {
  paymentId: string
  locationId: string | null
  orderId: string | null
  customerId: string | null
  appointmentDate: string | null
  currency: string | null
  amountTotal: number
  tipAmount: number
  processingFee: number
  netAmount: number | null
  status: string | null
  sourceType: string | null
  receiptNumber: string | null
  receiptUrl: string | null
  cardBrand: string | null
  cardLast4: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface SquareLocationInfo {
  id: string
  name?: string
  timezone?: string | null
  status?: string | null
}

export interface SquareOrderLineItem {
  name: string | null
  quantity: number | null
  catalogObjectId: string | null
  variationName: string | null
}

export interface SquareOrderRecord {
  orderId: string
  locationId: string | null
  customerId: string | null
  createdAt: string | null
  closedAt: string | null
  appointmentDate: string | null
  totalAmount: number
  currency: string | null
  lineItems: SquareOrderLineItem[]
  status: string | null
  source: string | null
}

export interface SquareLocationPayload {
  id?: string
  name?: string
  timezone?: string
  status?: string
}

export interface SquareBookingPayload {
  id?: string
  start_at?: string
  customer_details?: {
    email_address?: string
    phone_number?: string
    given_name?: string
    family_name?: string
  }
  customer_phone?: string
  appointment_segments?: Array<{
    service_variation_name?: string
    service_variation_price_money?: { amount?: number }
  }>
  customer_note?: string
  customer_id?: string
  location_id?: string
  order_id?: string
  team_member_id?: string
  status?: string
}

export interface SquarePaymentPayload {
  id?: string
  location_id?: string
  order_id?: string
  customer_id?: string
  amount_money?: { amount?: number; currency?: string }
  tip_money?: { amount?: number }
  processing_fee?: Array<{ amount_money?: { amount?: number } }>
  net_amount_money?: { amount?: number }
  status?: string
  source_type?: string
  receipt_number?: string
  receipt_url?: string
  created_at?: string
  updated_at?: string
  card_details?: {
    card?: {
      card_brand?: string
      last_4?: string
    }
  }
}

export interface SquareOrderPayload {
  id?: string
  location_id?: string
  customer_id?: string
  created_at?: string
  closed_at?: string
  total_money?: { amount?: number; currency?: string }
  line_items?: Array<{
    name?: string
    quantity?: string
    catalog_object_id?: string
    variation_name?: string
  }>
  state?: string
  source?: {
    name?: string
    type?: string
  }
}

export function normalizeSquareBooking(
  booking: SquareBookingPayload,
  timezone: string | null
): NormalizedAppointment | null {
  if (!booking?.id) return null

  const datetime = booking.start_at || ''
  const date = formatDateInTimezone(datetime, timezone) || datetime.split('T')[0]

  const email = booking.customer_details?.email_address?.trim().toLowerCase() || null
  const phone = booking.customer_phone || booking.customer_details?.phone_number || null
  const phoneNormalized = normalizeSquarePhone(phone)

  const firstName = booking.customer_details?.given_name?.trim() || null
  const lastName = booking.customer_details?.family_name?.trim() || null

  const serviceType = booking.appointment_segments?.[0]?.service_variation_name || null
  const priceMoney = booking.appointment_segments?.[0]?.service_variation_price_money
  const price = priceMoney?.amount ? Number(priceMoney.amount) / 100 : 0

  return {
    externalId: String(booking.id),
    datetime,
    date,
    email,
    phone,
    phoneNormalized,
    firstName,
    lastName,
    serviceType,
    price,
    tip: 0,
    notes: booking.customer_note || null,
    referralSource: null,
    customerId: booking.customer_id || null,
    locationId: booking.location_id || null,
    orderId: booking.order_id || null,
    teamMemberId: booking.team_member_id || null,
    status: booking.status || null,
  }
}

export function normalizeSquarePayment(
  payment: SquarePaymentPayload,
  timezone: string | null
): SquarePaymentRecord | null {
  if (!payment?.id) return null

  const amountTotal = toMoney(payment.amount_money)
  const tipAmount = toMoney(payment.tip_money)
  const processingFee = Array.isArray(payment.processing_fee)
    ? payment.processing_fee.reduce(
        (sum, fee) => sum + toMoney(fee?.amount_money),
        0
      )
    : 0
  const netAmount = payment.net_amount_money
    ? toMoney(payment.net_amount_money)
    : null

  return {
    paymentId: payment.id,
    locationId: payment.location_id || null,
    orderId: payment.order_id || null,
    customerId: payment.customer_id || null,
    appointmentDate: formatDateInTimezone(payment.created_at ?? null, timezone),
    currency: payment.amount_money?.currency || null,
    amountTotal,
    tipAmount,
    processingFee,
    netAmount,
    status: payment.status || null,
    sourceType: payment.source_type || null,
    receiptNumber: payment.receipt_number || null,
    receiptUrl: payment.receipt_url || null,
    cardBrand: payment.card_details?.card?.card_brand || null,
    cardLast4: payment.card_details?.card?.last_4 || null,
    createdAt: payment.created_at || null,
    updatedAt: payment.updated_at || null,
  }
}

export function normalizeSquareOrder(
  order: SquareOrderPayload,
  timezone: string | null
): SquareOrderRecord | null {
  if (!order?.id) return null

  const timestamp = order.closed_at || order.created_at || null

  const lineItems = Array.isArray(order.line_items)
    ? order.line_items.map((item) => ({
        name: item.name || null,
        quantity: item.quantity ? Number(item.quantity) : null,
        catalogObjectId: item.catalog_object_id || null,
        variationName: item.variation_name || null,
      }))
    : []

  return {
    orderId: order.id,
    locationId: order.location_id || null,
    customerId: order.customer_id || null,
    createdAt: order.created_at || null,
    closedAt: order.closed_at || null,
    appointmentDate: formatDateInTimezone(timestamp, timezone),
    totalAmount: toMoney(order.total_money),
    currency: order.total_money?.currency || null,
    lineItems,
    status: order.state || null,
    source: order.source?.name || order.source?.type || null,
  }
}

export function normalizeSquarePhone(phone: string | null): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[^0-9]/g, '')

  if (/^1[0-9]{10}$/.test(cleaned)) return `+${cleaned}`
  if (/^[0-9]{10}$/.test(cleaned)) return `+1${cleaned}`

  if (cleaned.length === 11 && cleaned[0] !== '1') {
    const withoutFirst = cleaned.substring(1)
    if (/^[0-9]{10}$/.test(withoutFirst)) return `+1${withoutFirst}`
  }

  return cleaned.length > 0 ? `+${cleaned}` : null
}

export function formatDateInTimezone(
  isoString: string | null,
  timeZone: string | null
): string | null {
  if (!isoString) return null
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return null

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    return formatter.format(date)
  } catch (error) {
    console.error('Failed to format date in timezone:', error)
    return date.toISOString().split('T')[0]
  }
}

function toMoney(money: { amount?: number } | null | undefined): number {
  if (!money?.amount) return 0
  return Number(money.amount) / 100
}
