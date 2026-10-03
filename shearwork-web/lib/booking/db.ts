// lib/booking/db.ts
// Helpers for reading large result sets from Supabase/PostgREST.
//
// PostgREST caps every response at `max_rows` (1000 on this project). A plain
// `.select()` silently returns only the first 1000 rows, so anything that can grow
// past that (a barber's clients, a year of appointments) must be read in pages.

/** Rows per page. Must not exceed the project's PostgREST max_rows (1000). */
export const PAGE_SIZE = 1000

/** Max values per `.in()` filter, keeping the request URL well under proxy limits. */
export const IN_CHUNK_SIZE = 200

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/**
 * Reads every row of a query, page by page.
 *
 * `buildPage(from, to)` must return a fresh query ending in `.range(from, to)` and
 * ordered by a unique column (e.g. the primary key), otherwise pages can overlap or skip.
 */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PageResult<T>,
  pageSize = PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildPage(from, from + pageSize - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

/** Splits a list into chunks of at most `size` items. */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * Runs `query` once per chunk of `ids` (for `.in()` filters) and concatenates the
 * rows. Each chunk's query should itself be paginated with fetchAllRows if a chunk
 * can return more than PAGE_SIZE rows.
 */
export async function fetchByIdChunks<T>(
  ids: string[],
  query: (idChunk: string[]) => Promise<T[]>,
  chunkSize = IN_CHUNK_SIZE
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const rows: T[] = []
  for (const idChunk of chunk(unique, chunkSize)) {
    rows.push(...(await query(idChunk)))
  }
  return rows
}

/** Minimal shape of a Supabase select builder that can be ordered and paged. */
interface PageableQuery<T> {
  order(column: string): PageableQuery<T>
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }>
}

/**
 * Drop-in replacement for `await supabase.from(...).select(...).eq(...)` that reads
 * every page. Returns the usual `{ data, error }` so existing error handling still works.
 * `orderColumn` must be unique (usually the primary key) for stable paging.
 */
export async function selectAll<T = Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  build: () => PageableQuery<T>,
  orderColumn: string
): Promise<{ data: T[] | null; error: unknown }> {
  try {
    const data = await fetchAllRows<T>((from, to) => build().order(orderColumn).range(from, to))
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/** selectAll for queries filtered with `.in(column, ids)`: chunks the ids and pages each chunk. */
export async function selectAllIn<T = Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  ids: string[],
  build: (idChunk: string[]) => PageableQuery<T>,
  orderColumn: string
): Promise<{ data: T[] | null; error: unknown }> {
  try {
    const data = await fetchByIdChunks(ids, idChunk =>
      fetchAllRows<T>((from, to) => build(idChunk).order(orderColumn).range(from, to))
    )
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}
