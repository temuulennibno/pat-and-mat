import { describe, it, expect } from 'vitest'
import { generateId, generateRoomCode, shuffleAndPair } from '@/app/lib/utils'

describe('generateId', () => {
  it('returns a string of expected length', () => {
    const id = generateId()
    expect(id).toHaveLength(12)
    expect(typeof id).toBe('string')
  })

  it('returns unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

describe('generateRoomCode', () => {
  it('returns a 4-character uppercase alphanumeric string', () => {
    const code = generateRoomCode()
    expect(code).toMatch(/^[A-Z0-9]{4}$/)
  })

  it('returns unique codes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()))
    expect(codes.size).toBe(50)
  })
})

describe('shuffleAndPair', () => {
  it('pairs 6 players into 3 teams', () => {
    const playerIds = ['a', 'b', 'c', 'd', 'e', 'f']
    const teams = shuffleAndPair(playerIds)
    expect(teams).toHaveLength(3)
    const allPlayerIds = teams.flatMap((t) => [t.player1Id, t.player2Id])
    expect(new Set(allPlayerIds).size).toBe(6)
  })

  it('pairs 12 players into 6 teams', () => {
    const playerIds = Array.from({ length: 12 }, (_, i) => `p${i}`)
    const teams = shuffleAndPair(playerIds)
    expect(teams).toHaveLength(6)
  })

  it('handles odd number by leaving one player out', () => {
    const playerIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const teams = shuffleAndPair(playerIds)
    expect(teams).toHaveLength(3)
  })

  it('produces different orderings on multiple calls', () => {
    const playerIds = Array.from({ length: 12 }, (_, i) => `p${i}`)
    const results = Array.from({ length: 10 }, () =>
      shuffleAndPair(playerIds).map((t) => `${t.player1Id}-${t.player2Id}`)
    )
    const unique = new Set(results.map((r) => r.join(',')))
    expect(unique.size).toBeGreaterThan(1)
  })
})
