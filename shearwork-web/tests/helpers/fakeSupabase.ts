// Minimal chainable stand-in for a Supabase client. Every query is recorded in `ops`
// and answered by the `respond` callback, so tests can assert exactly what a route
// read or wrote without a database.

export type Op = {
  table?: string
  rpc?: string
  action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc'
  columns?: string
  payload?: unknown
  filters: Array<[string, ...unknown[]]>
  single?: boolean
}

export type Resp = { data?: unknown; error?: { code?: string; message: string } | null }

export function fakeSupabase(respond: (op: Op) => Resp = () => ({ data: null, error: null })) {
  const ops: Op[] = []

  const builder = (table: string) => {
    const op: Op = { table, action: 'select', filters: [] }
    let recorded = false
    const run = () => {
      if (!recorded) {
        ops.push(op)
        recorded = true
      }
      const r = respond(op)
      return { data: r.data ?? null, error: r.error ?? null }
    }
    const chain: Record<string, unknown> = {}
    const filter = (name: string) => (...args: unknown[]) => {
      op.filters.push([name, ...args])
      return chain
    }
    Object.assign(chain, {
      select: (columns?: string) => {
        if (op.action === 'select') op.columns = columns
        return chain
      },
      insert: (payload: unknown) => { op.action = 'insert'; op.payload = payload; return chain },
      update: (payload: unknown) => { op.action = 'update'; op.payload = payload; return chain },
      upsert: (payload: unknown) => { op.action = 'upsert'; op.payload = payload; return chain },
      delete: () => { op.action = 'delete'; return chain },
      eq: filter('eq'), neq: filter('neq'), in: filter('in'), ilike: filter('ilike'),
      gte: filter('gte'), lte: filter('lte'), lt: filter('lt'), gt: filter('gt'),
      is: filter('is'), or: filter('or'), order: filter('order'), limit: filter('limit'),
      range: filter('range'),
      single: () => { op.single = true; return Promise.resolve(run()) },
      maybeSingle: () => { op.single = true; return Promise.resolve(run()) },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    })
    return chain
  }

  const client = {
    ops,
    from: (table: string) => builder(table),
    rpc: (name: string, args: unknown) => {
      const op: Op = { rpc: name, action: 'rpc', payload: args, filters: [] }
      ops.push(op)
      const r = respond(op)
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null })
    },
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      admin: { getUserById: async () => ({ data: { user: null }, error: null }) },
    },
    functions: { invoke: async () => ({ data: { ok: true }, error: null }) },
  }
  return client
}

export type FakeSupabase = ReturnType<typeof fakeSupabase>
