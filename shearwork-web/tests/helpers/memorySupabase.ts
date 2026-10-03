// In-memory Supabase/PostgREST stand-in that behaves like the real one where it
// matters for the sync code: filters, ordering, .range() paging, upsert onConflict,
// and - crucially - the server-side cap of MAX_ROWS rows per response.

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

export const MAX_ROWS = 1000

export function memorySupabase(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {}
  for (const [name, rows] of Object.entries(initial)) tables[name] = rows.map(r => ({ ...r }))
  const stats = { requests: 0, byTable: {} as Record<string, number>, rowsReturned: 0 }

  const table = (name: string) => (tables[name] ??= [])

  function builder(name: string) {
    let action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
    let payload: Row | Row[] | null = null
    let onConflict: string[] = []
    let wantsReturn = false
    let countMode = false
    let head = false
    const filters: Filter[] = []
    let orderCol: string | null = null
    let orderAsc = true
    let rangeFrom: number | null = null
    let rangeTo: number | null = null
    let limitN: number | null = null
    let single: 'single' | 'maybe' | null = null

    const execute = () => {
      stats.requests++
      stats.byTable[name] = (stats.byTable[name] ?? 0) + 1
      const rows = table(name)

      if (action === 'insert' || action === 'upsert') {
        const list = Array.isArray(payload) ? payload : [payload!]
        const written: Row[] = []
        for (const incoming of list) {
          const existing = onConflict.length
            ? rows.find(r => onConflict.every(c => r[c] === incoming[c]))
            : undefined
          if (existing && action === 'upsert') {
            Object.assign(existing, incoming)
            written.push(existing)
          } else {
            const row = { id: `${name}-${rows.length + 1}`, revenue: null, tip: null, ...incoming }
            rows.push(row)
            written.push(row)
          }
        }
        return { data: wantsReturn ? written.map(r => ({ ...r })) : null, error: null }
      }

      let matched = rows.filter(r => filters.every(f => f(r)))

      if (action === 'update') {
        for (const r of matched) Object.assign(r, payload)
        return { data: wantsReturn ? matched.map(r => ({ ...r })) : null, error: null }
      }
      if (action === 'delete') {
        tables[name] = rows.filter(r => !matched.includes(r))
        return { data: wantsReturn ? matched.map(r => ({ ...r })) : null, error: null }
      }

      if (countMode && head) return { data: null, count: matched.length, error: null }

      if (orderCol) {
        const col = orderCol
        matched = [...matched].sort((a, b) =>
          String(a[col]).localeCompare(String(b[col]), undefined, { numeric: true }) * (orderAsc ? 1 : -1)
        )
      }
      if (rangeFrom !== null && rangeTo !== null) matched = matched.slice(rangeFrom, rangeTo + 1)
      if (limitN !== null) matched = matched.slice(0, limitN)
      matched = matched.slice(0, MAX_ROWS) // PostgREST max_rows
      stats.rowsReturned += matched.length

      const data = matched.map(r => ({ ...r }))
      if (single) {
        if (data.length === 0) return { data: null, error: single === 'single' ? { message: 'no rows' } : null }
        return { data: data[0], error: null }
      }
      return { data, count: countMode ? data.length : undefined, error: null }
    }

    const chain = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (action !== 'select') wantsReturn = true
        if (opts?.count) countMode = true
        if (opts?.head) head = true
        return chain
      },
      insert(p: Row | Row[]) { action = 'insert'; payload = p; return chain },
      upsert(p: Row | Row[], opts?: { onConflict?: string }) {
        action = 'upsert'; payload = p
        onConflict = (opts?.onConflict ?? '').split(',').map(s => s.trim()).filter(Boolean)
        return chain
      },
      update(p: Row) { action = 'update'; payload = p; return chain },
      delete() { action = 'delete'; return chain },
      eq(c: string, v: unknown) { filters.push(r => r[c] === v); return chain },
      neq(c: string, v: unknown) { filters.push(r => r[c] !== v); return chain },
      gte(c: string, v: string | number) { filters.push(r => r[c] !== null && r[c] !== undefined && String(r[c]) >= String(v)); return chain },
      lte(c: string, v: string | number) { filters.push(r => r[c] !== null && r[c] !== undefined && String(r[c]) <= String(v)); return chain },
      in(c: string, vs: unknown[]) {
        if (vs.length > 500) throw new Error(`.in() with ${vs.length} values: URL too long`)
        const set = new Set(vs)
        filters.push(r => set.has(r[c]))
        return chain
      },
      or() { return chain },
      order(c: string, opts?: { ascending?: boolean }) { orderCol = c; orderAsc = opts?.ascending ?? true; return chain },
      range(from: number, to: number) { rangeFrom = from; rangeTo = to; return chain },
      limit(n: number) { limitN = n; return chain },
      single() { single = 'single'; return Promise.resolve(execute()) },
      maybeSingle() { single = 'maybe'; return Promise.resolve(execute()) },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        try {
          return Promise.resolve(execute()).then(resolve, reject)
        } catch (err) {
          return Promise.reject(err).then(resolve, reject)
        }
      },
    }
    return chain
  }

  return {
    tables,
    stats,
    from: (name: string) => builder(name),
    rpc: async () => ({ data: null, error: null }),
  }
}
