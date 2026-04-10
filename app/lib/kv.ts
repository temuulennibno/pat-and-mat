type Entry = {
  value: string
  expiresAt: number
}

const store = new Map<string, Entry>()

export const kv = {
  async get<T>(key: string): Promise<T | null> {
    const entry = store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      store.delete(key)
      return null
    }
    return JSON.parse(entry.value) as T
  },

  async set(key: string, value: unknown, options?: { ex?: number }): Promise<void> {
    const ttl = options?.ex ?? 7200
    store.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttl * 1000,
    })
  },

  async del(key: string): Promise<void> {
    store.delete(key)
  },
}
