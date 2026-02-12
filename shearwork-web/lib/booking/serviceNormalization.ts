export const DEFAULT_PRIMARY_SERVICE = 'Haircut'

export function normalizeServiceName(value?: string | null): string {
  const name = (value ?? '').trim().toLowerCase()

  if (!name) return DEFAULT_PRIMARY_SERVICE
  if (name.includes('haircut')) return DEFAULT_PRIMARY_SERVICE
  if (name.includes('kids')) return 'Kids Haircut'
  if (name.includes('lineup')) return 'Lineup'
  if (name.includes('beard')) return 'Beard'
  if (name.includes('shave')) return 'Head Shave'

  return value?.trim() || DEFAULT_PRIMARY_SERVICE
}

export function isDefaultServiceName(value?: string | null): boolean {
  return normalizeServiceName(value).toLowerCase() === DEFAULT_PRIMARY_SERVICE.toLowerCase()
}
