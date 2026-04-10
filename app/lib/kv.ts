import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const kv = {
  async get<T>(key: string): Promise<T | null> {
    return redis.get<T>(key)
  },

  async set(key: string, value: unknown, options?: { ex?: number }): Promise<void> {
    const ttl = options?.ex ?? 7200
    await redis.set(key, value, { ex: ttl })
  },

  async del(key: string): Promise<void> {
    await redis.del(key)
  },
}
