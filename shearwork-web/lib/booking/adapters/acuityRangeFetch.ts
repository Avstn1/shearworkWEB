// lib/booking/adapters/acuityRangeFetch.ts
//
// Fetches every Acuity appointment in a date range with as few requests as possible.
//
// Acuity's /appointments endpoint returns at most `max` results per request and has
// no pagination. The rule that makes large ranges safe:
//
//   if a request returns FEWER than `max` results, the range is complete.
//
// So we request big chunks (a week by default), run several at once, and only split
// a chunk in half when it comes back full. Dense weeks split down to days; quiet
// months cost one request per week. A single day that is still full is retried in
// both sort directions and merged (covers up to 2 x max); anything beyond that is
// reported in `saturatedDays` so the caller can treat the result as incomplete.

export interface AcuityRawAppointment {
  id: number | string
  [key: string]: unknown
}

export interface RangeFetchOptions {
  /** Results requested per call (Acuity `max`). Keep at a value Acuity is known to honor. */
  pageLimit: number
  /** Days per initial chunk. */
  initialChunkDays: number
  /** Requests in flight at once. */
  concurrency: number
}

export interface RangeFetchResult {
  appointments: AcuityRawAppointment[]
  requests: number
  /** Days that still returned a full page after the ASC/DESC fallback (possible missing data). */
  saturatedDays: string[]
}

/** Fetches one page for an inclusive date range. Must throw on failure (after retries). */
export type FetchPage = (
  startISO: string,
  endISO: string,
  direction: 'ASC' | 'DESC'
) => Promise<AcuityRawAppointment[]>

export const DEFAULT_RANGE_FETCH_OPTIONS: RangeFetchOptions = {
  pageLimit: 100,
  initialChunkDays: 7,
  concurrency: 4,
}

// ---- date helpers (pure YYYY-MM-DD arithmetic in UTC, no timezone drift) ----

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function daysBetween(startISO: string, endISO: string): number {
  const toMs = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toMs(endISO) - toMs(startISO)) / 86_400_000)
}

/** Splits [start, end] into consecutive chunks of `size` days. */
export function splitIntoChunks(startISO: string, endISO: string, size: number): Array<[string, string]> {
  const chunks: Array<[string, string]> = []
  for (let cursor = startISO; daysBetween(cursor, endISO) >= 0; cursor = addDays(cursor, size)) {
    const chunkEnd = addDays(cursor, size - 1)
    chunks.push([cursor, daysBetween(chunkEnd, endISO) >= 0 ? chunkEnd : endISO])
  }
  return chunks
}

// ---- main ----

export async function fetchAppointmentRange(
  fetchPage: FetchPage,
  startISO: string,
  endISO: string,
  options: Partial<RangeFetchOptions> = {}
): Promise<RangeFetchResult> {
  const opts = { ...DEFAULT_RANGE_FETCH_OPTIONS, ...options }
  if (daysBetween(startISO, endISO) < 0) {
    return { appointments: [], requests: 0, saturatedDays: [] }
  }

  const byId = new Map<string, AcuityRawAppointment>()
  const saturatedDays: string[] = []
  let requests = 0

  const add = (items: AcuityRawAppointment[]) => {
    for (const item of items) byId.set(String(item.id), item)
  }

  const page = async (start: string, end: string, direction: 'ASC' | 'DESC') => {
    requests++
    return fetchPage(start, end, direction)
  }

  // Work queue of ranges; full ranges push their two halves back onto it.
  const queue: Array<[string, string]> = splitIntoChunks(startISO, endISO, opts.initialChunkDays)

  const processRange = async ([start, end]: [string, string]) => {
    const items = await page(start, end, 'DESC')

    if (items.length < opts.pageLimit) {
      add(items)
      return
    }

    const span = daysBetween(start, end)
    if (span > 0) {
      // Full page: the range may be truncated. Split and fetch both halves.
      const mid = addDays(start, Math.floor(span / 2))
      queue.push([start, mid], [addDays(mid, 1), end])
      return
    }

    // A single day that is still full: read it from both ends and merge.
    const ascending = await page(start, end, 'ASC')
    add(items)
    add(ascending)
    const descIds = new Set(items.map(i => String(i.id)))
    const overlaps = ascending.some(i => descIds.has(String(i.id)))
    const sameSet = ascending.length === items.length && ascending.every(i => descIds.has(String(i.id)))
    // Overlapping halves (reading from both ends) cover the whole day. Identical sets
    // are complete only if the two responses really came back in opposite orders;
    // otherwise Acuity may have ignored `direction` and we can't prove completeness.
    const complete = sameSet ? orderedOppositely(items, ascending) : overlaps
    if (!complete) saturatedDays.push(start)
  }

  // Worker pool over a queue that grows while we work (split ranges are pushed back).
  await new Promise<void>((resolve, reject) => {
    let inFlight = 0
    let failed = false
    const pump = () => {
      if (failed) return
      while (inFlight < Math.max(1, opts.concurrency) && queue.length > 0) {
        const range = queue.shift()!
        inFlight++
        processRange(range).then(
          () => {
            inFlight--
            pump()
          },
          err => {
            failed = true
            reject(err)
          }
        )
      }
      if (inFlight === 0 && queue.length === 0) resolve()
    }
    pump()
  })

  return {
    appointments: Array.from(byId.values()),
    requests,
    saturatedDays: Array.from(new Set(saturatedDays)).sort(),
  }
}

const timeOf = (item: AcuityRawAppointment) => {
  const raw = typeof item.datetime === 'string' ? item.datetime : ''
  const ms = Date.parse(raw.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
  return Number.isNaN(ms) ? null : ms
}

/** True if `desc` starts later than `asc` starts, i.e. the API honored the sort direction. */
function orderedOppositely(desc: AcuityRawAppointment[], asc: AcuityRawAppointment[]): boolean {
  const descFirst = desc.length ? timeOf(desc[0]) : null
  const ascFirst = asc.length ? timeOf(asc[0]) : null
  return descFirst !== null && ascFirst !== null && descFirst > ascFirst
}

// ---- HTTP with retries ----

export class AcuityRequestError extends Error {
  constructor(message: string, readonly status?: number, readonly retryAfterMs?: number) {
    super(message)
    this.name = 'AcuityRequestError'
  }
}

export interface RetryOptions {
  retries: number
  baseDelayMs: number
  maxDelayMs: number
  sleep?: (ms: number) => Promise<void>
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = { retries: 4, baseDelayMs: 500, maxDelayMs: 15_000 }

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * fetch() that retries rate limits (429), server errors (5xx) and network errors with
 * exponential backoff + jitter, honoring Retry-After. Client errors (401, 400...) fail fast.
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  options: Partial<RetryOptions> = {},
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  const sleep = opts.sleep ?? defaultSleep
  let lastError: AcuityRequestError | null = null

  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1))
      const jitter = Math.random() * opts.baseDelayMs
      const retryAfter = lastError?.retryAfterMs
      await sleep(retryAfter !== undefined ? Math.min(retryAfter, opts.maxDelayMs) : backoff + jitter)
    }

    let response: Response
    try {
      response = await fetchImpl(url, init)
    } catch (err) {
      lastError = new AcuityRequestError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }

    if (response.ok) return (await response.json()) as T

    const retryable = response.status === 429 || response.status >= 500
    const retryAfterSeconds = Number(response.headers.get('retry-after'))
    const error = new AcuityRequestError(
      `Acuity responded ${response.status}`,
      response.status,
      response.headers.get('retry-after') && Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : undefined
    )
    if (!retryable) throw error
    lastError = error
  }

  throw lastError ?? new AcuityRequestError('Acuity request failed')
}
