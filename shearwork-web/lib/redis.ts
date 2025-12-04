// lib/redis.ts
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const authCodeCache = {
  /**
   * Store a one-time auth code that maps to a userId
   * @param code - Random UUID
   * @param userId - Supabase user ID
   * @param ttlSeconds - Time to live in seconds (default 5 minutes)
   */
  set: async (code: string, userId: string, ttlSeconds: number = 300) => {
    await redis.set(`auth:${code}`, userId, { ex: ttlSeconds })
  },
  
  /**
   * Get userId by code
   * @returns userId or null if expired/not found
   */
  get: async (code: string): Promise<string | null> => {
    return await redis.get(`auth:${code}`)
  },
  
  /**
   * Delete code (one-time use)
   */
  delete: async (code: string) => {
    await redis.del(`auth:${code}`)
  }
}