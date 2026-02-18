// utils/validation.ts

/**
 * Validates whether a string is a valid UUID (v1-5).
 * Returns true if the string matches the UUID format, false otherwise.
 */
export function isValidUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}
