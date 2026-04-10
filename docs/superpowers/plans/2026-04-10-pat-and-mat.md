# Pat and Mat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time multiplayer Axis Split drawing game with room codes, voting, and 5-round progression.

**Architecture:** Client-heavy with thin API routes. Host client drives game flow via Ably pub/sub. In-memory KV store for room state (swappable to Redis later). All game pages are client-rendered.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Ably SDK, Vitest

---

## File Structure

```
app/
  lib/
    types.ts              — All TypeScript types/interfaces
    prompts.ts            — Drawing prompts by difficulty tier
    scoring.ts            — Score calculation (normalize, bonus, anti-troll)
    utils.ts              — generateId, generateRoomCode, shuffleAndPair
    kv.ts                 — In-memory KV store with TTL
    ably.ts               — Ably client creation helper
    player-context.tsx    — PlayerProvider + usePlayer hook
    game-engine.ts        — useGameEngine hook (state machine + Ably events)
  api/
    rooms/
      route.ts            — POST create room
      [code]/
        route.ts          — GET room info
        join/
          route.ts        — POST join room
    ably/
      auth/
        route.ts          — GET Ably token request
  page.tsx                — Home: create/join room
  room/
    [code]/
      page.tsx            — Lobby: player list, start game
      play/
        page.tsx          — Game: orchestrates all phases
        components/
          drawing-canvas.tsx  — Axis Split canvas + Ably sync
          stroke-replay.tsx   — Animated stroke playback
          voting-phase.tsx    — Vote UI + timer + auto-submit
          results-phase.tsx   — Round results + scoreboard
          final-results.tsx   — End game: winner, MVP, stats
tests/
  scoring.test.ts         — Score calculation tests
  utils.test.ts           — Utility function tests
```

---

### Task 1: Project Setup & Types

**Files:**
- Create: `app/lib/types.ts`
- Create: `.env.local`
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && bun add ably && bun add -d vitest
```

- [ ] **Step 2: Create environment variables file**

Create `.env.local`:
```
ABLY_API_KEY=your-ably-api-key-here
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Create all shared types**

Create `app/lib/types.ts`:
```ts
export type Player = {
  id: string
  name: string
  joinedAt: number
}

export type RoomStatus = 'waiting' | 'playing' | 'finished'

export type Room = {
  code: string
  hostId: string
  players: Player[]
  status: RoomStatus
  createdAt: number
}

export type Team = {
  id: string
  player1Id: string
  player2Id: string
}

export type Point = {
  x: number
  y: number
  t: number
}

export type Stroke = Point[]

export type Drawing = Stroke[]

export type Vote = {
  voterId: string
  teamId: string
  vote: 'good' | 'bad'
}

export type GamePhase = 'drawing' | 'viewing' | 'voting' | 'results'

export type GameState = {
  round: number
  phase: GamePhase
  teams: Team[]
  prompt: string
  cumulativeScores: Record<string, number>
  roundScores: Record<string, number>
  drawings: Record<string, Drawing>
  votes: Vote[]
}

export type Difficulty = 'concrete' | 'abstract' | 'complex' | 'action' | 'chaotic'

export type RoundStartEvent = {
  round: number
  difficulty: Difficulty
  prompt: string
  teams: Team[]
}

export type VoteEvent = {
  voterId: string
  teamId: string
  vote: 'good' | 'bad'
}

export type RoundResultEvent = {
  round: number
  roundScores: Record<string, number>
  cumulativeScores: Record<string, number>
  bonusTeams: string[]
}

export type DrawingSubmitEvent = {
  teamId: string
  drawing: Drawing
}

export type GameEndEvent = {
  finalScores: Record<string, number>
  winnerTeamId: string
  mvpPlayerId: string
  playerGoodVotes: Record<string, number>
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: project setup with ably, vitest, and shared types"
```

---

### Task 2: Utility Functions + Tests

**Files:**
- Create: `app/lib/utils.ts`
- Create: `tests/utils.test.ts`

- [ ] **Step 1: Write failing tests for utility functions**

Create `tests/utils.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx vitest run tests/utils.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement utility functions**

Create `app/lib/utils.ts`:
```ts
import type { Team } from './types'

export function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export function shuffleAndPair(playerIds: string[]): Team[] {
  const shuffled = [...playerIds]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const teams: Team[] = []
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    teams.push({
      id: `team-${Math.floor(i / 2)}`,
      player1Id: shuffled[i],
      player2Id: shuffled[i + 1],
    })
  }
  return teams
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx vitest run tests/utils.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/lib/utils.ts tests/utils.test.ts && git commit -m "feat: add utility functions (id gen, room codes, shuffle & pair)"
```

---

### Task 3: Scoring Logic + Prompts + Tests

**Files:**
- Create: `app/lib/scoring.ts`
- Create: `app/lib/prompts.ts`
- Create: `tests/scoring.test.ts`

- [ ] **Step 1: Write failing tests for scoring**

Create `tests/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { calculateTeamRoundScore, detectTrolls } from '@/app/lib/scoring'
import type { Vote } from '@/app/lib/types'

describe('calculateTeamRoundScore', () => {
  it('returns 0 when no votes', () => {
    expect(calculateTeamRoundScore([], 'team-0', 1)).toBe(0)
  })

  it('returns 10 when all good votes', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'good' },
      { voterId: 'p3', teamId: 'team-0', vote: 'good' },
    ]
    expect(calculateTeamRoundScore(votes, 'team-0', 1)).toBe(12) // 10 + 2 bonus (100% > 70%)
  })

  it('returns 0 when all bad votes', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'bad' },
      { voterId: 'p2', teamId: 'team-0', vote: 'bad' },
    ]
    expect(calculateTeamRoundScore(votes, 'team-0', 1)).toBe(0)
  })

  it('calculates normalized score correctly for mixed votes', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'good' },
      { voterId: 'p3', teamId: 'team-0', vote: 'bad' },
      { voterId: 'p4', teamId: 'team-0', vote: 'bad' },
    ]
    // 2/4 = 0.5 -> round(0.5 * 10) = 5, no bonus (50% < 70%)
    expect(calculateTeamRoundScore(votes, 'team-0', 1)).toBe(5)
  })

  it('adds +2 bonus when >= 70% good', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'good' },
      { voterId: 'p3', teamId: 'team-0', vote: 'good' },
      { voterId: 'p4', teamId: 'team-0', vote: 'bad' },
    ]
    // 3/4 = 0.75 -> round(0.75 * 10) = 8, +2 bonus = 10
    expect(calculateTeamRoundScore(votes, 'team-0', 1)).toBe(10)
  })

  it('doubles score in round 5', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'bad' },
    ]
    // 1/2 = 0.5 -> round(0.5 * 10) = 5, no bonus, x2 = 10
    expect(calculateTeamRoundScore(votes, 'team-0', 5)).toBe(10)
  })

  it('doubles score including bonus in round 5', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'good' },
      { voterId: 'p3', teamId: 'team-0', vote: 'good' },
      { voterId: 'p4', teamId: 'team-0', vote: 'bad' },
    ]
    // 3/4 = 0.75 -> 8 + 2 bonus = 10, x2 = 20
    expect(calculateTeamRoundScore(votes, 'team-0', 5)).toBe(20)
  })

  it('ignores votes for other teams', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-1', vote: 'bad' },
    ]
    // Only 1 vote for team-0: 1/1 = 1.0 -> 10 + 2 bonus = 12
    expect(calculateTeamRoundScore(votes, 'team-0', 1)).toBe(12)
  })
})

describe('detectTrolls', () => {
  it('returns empty array when no trolls', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p1', teamId: 'team-1', vote: 'bad' },
      { voterId: 'p2', teamId: 'team-0', vote: 'bad' },
      { voterId: 'p2', teamId: 'team-1', vote: 'good' },
    ]
    expect(detectTrolls(votes)).toEqual([])
  })

  it('detects player who voted all bad', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'bad' },
      { voterId: 'p1', teamId: 'team-1', vote: 'bad' },
      { voterId: 'p1', teamId: 'team-2', vote: 'bad' },
      { voterId: 'p2', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-1', vote: 'bad' },
      { voterId: 'p2', teamId: 'team-2', vote: 'good' },
    ]
    expect(detectTrolls(votes)).toEqual(['p1'])
  })

  it('does not flag player voting bad on a single team', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'bad' },
    ]
    // Only voted on 1 team — not trolling, just one vote
    expect(detectTrolls(votes)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx vitest run tests/scoring.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement scoring functions**

Create `app/lib/scoring.ts`:
```ts
import type { Vote } from './types'

export function calculateTeamRoundScore(
  votes: Vote[],
  teamId: string,
  round: number
): number {
  const teamVotes = votes.filter((v) => v.teamId === teamId)
  if (teamVotes.length === 0) return 0

  const goodVotes = teamVotes.filter((v) => v.vote === 'good').length
  const totalVotes = teamVotes.length
  const ratio = goodVotes / totalVotes

  let score = Math.round(ratio * 10)
  if (ratio >= 0.7) score += 2
  if (round === 5) score *= 2

  return score
}

export function detectTrolls(votes: Vote[]): string[] {
  const voterMap = new Map<string, Vote[]>()
  for (const v of votes) {
    const existing = voterMap.get(v.voterId) || []
    existing.push(v)
    voterMap.set(v.voterId, existing)
  }

  const trolls: string[] = []
  for (const [voterId, voterVotes] of voterMap) {
    if (voterVotes.length < 2) continue
    if (voterVotes.every((v) => v.vote === 'bad')) {
      trolls.push(voterId)
    }
  }
  return trolls
}

export function filterTrollVotes(votes: Vote[]): Vote[] {
  const trollIds = new Set(detectTrolls(votes))
  return votes.filter((v) => !trollIds.has(v.voterId))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx vitest run tests/scoring.test.ts
```

Expected: all PASS

- [ ] **Step 5: Create prompts data**

Create `app/lib/prompts.ts`:
```ts
import type { Difficulty } from './types'

const prompts: Record<Difficulty, string[]> = {
  concrete: [
    'Draw a house',
    'Draw a cat',
    'Draw a tree',
    'Draw a car',
    'Draw a flower',
    'Draw a fish',
    'Draw a sun',
    'Draw a dog',
    'Draw a boat',
    'Draw a pizza',
  ],
  abstract: [
    'Draw happiness',
    'Draw loneliness',
    'Draw music',
    'Draw time',
    'Draw silence',
    'Draw chaos',
    'Draw freedom',
    'Draw love',
    'Draw anger',
    'Draw peace',
  ],
  complex: [
    'Draw a bicycle',
    'Draw a helicopter',
    'Draw a castle',
    'Draw a robot',
    'Draw an elephant',
    'Draw a guitar',
    'Draw a spaceship',
    'Draw a rollercoaster',
    'Draw a dinosaur',
    'Draw a lighthouse',
  ],
  action: [
    'Someone running late',
    'A chef cooking disaster',
    'Someone slipping on ice',
    'A surprise birthday party',
    'Someone lost in a forest',
    'A cat chasing a laser',
    'Someone trying to park',
    'A dog stealing food',
    'Someone skydiving',
    'A kid seeing snow for the first time',
  ],
  chaotic: [
    'Something both hot and cold',
    'A loud silence',
    'Organized chaos',
    'A happy disaster',
    'Something big and tiny',
    'A fast snail',
    'Dry rain',
    'A friendly monster',
    'Beautiful ugliness',
    'Calm panic',
  ],
}

const roundDifficulty: Record<number, Difficulty> = {
  1: 'concrete',
  2: 'abstract',
  3: 'complex',
  4: 'action',
  5: 'chaotic',
}

export function getPromptForRound(round: number): string {
  const difficulty = roundDifficulty[round] || 'concrete'
  const pool = prompts[difficulty]
  return pool[Math.floor(Math.random() * pool.length)]
}

export function getDifficulty(round: number): Difficulty {
  return roundDifficulty[round] || 'concrete'
}
```

- [ ] **Step 6: Commit**

```bash
git add app/lib/scoring.ts app/lib/prompts.ts tests/scoring.test.ts && git commit -m "feat: add scoring logic, troll detection, and drawing prompts"
```

---

### Task 4: KV Store + API Routes

**Files:**
- Create: `app/lib/kv.ts`
- Create: `app/api/rooms/route.ts`
- Create: `app/api/rooms/[code]/route.ts`
- Create: `app/api/rooms/[code]/join/route.ts`
- Create: `app/api/ably/auth/route.ts`

- [ ] **Step 1: Create in-memory KV store**

Create `app/lib/kv.ts`:
```ts
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
```

- [ ] **Step 2: Create POST /api/rooms route**

Create `app/api/rooms/route.ts`:
```ts
import { kv } from '@/app/lib/kv'
import { generateRoomCode, generateId } from '@/app/lib/utils'
import type { Room } from '@/app/lib/types'

export async function POST(request: Request) {
  const body = await request.json()
  const { playerName } = body

  if (!playerName || typeof playerName !== 'string') {
    return Response.json({ error: 'playerName is required' }, { status: 400 })
  }

  let code = generateRoomCode()
  let existing = await kv.get<Room>(`room:${code}`)
  let attempts = 0
  while (existing && attempts < 10) {
    code = generateRoomCode()
    existing = await kv.get<Room>(`room:${code}`)
    attempts++
  }

  const playerId = generateId()
  const room: Room = {
    code,
    hostId: playerId,
    players: [{ id: playerId, name: playerName, joinedAt: Date.now() }],
    status: 'waiting',
    createdAt: Date.now(),
  }

  await kv.set(`room:${code}`, room, { ex: 7200 })

  return Response.json({ code, playerId, room })
}
```

- [ ] **Step 3: Create GET /api/rooms/[code] route**

Create `app/api/rooms/[code]/route.ts`:
```ts
import { kv } from '@/app/lib/kv'
import type { Room } from '@/app/lib/types'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/rooms/[code]'>
) {
  const { code } = await ctx.params

  const room = await kv.get<Room>(`room:${code}`)
  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }

  return Response.json({ room })
}
```

- [ ] **Step 4: Create POST /api/rooms/[code]/join route**

Create `app/api/rooms/[code]/join/route.ts`:
```ts
import { kv } from '@/app/lib/kv'
import { generateId } from '@/app/lib/utils'
import type { Room } from '@/app/lib/types'

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/rooms/[code]/join'>
) {
  const { code } = await ctx.params
  const body = await request.json()
  const { playerName } = body

  if (!playerName || typeof playerName !== 'string') {
    return Response.json({ error: 'playerName is required' }, { status: 400 })
  }

  const room = await kv.get<Room>(`room:${code}`)
  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.status !== 'waiting') {
    return Response.json({ error: 'Game already in progress' }, { status: 400 })
  }

  if (room.players.length >= 12) {
    return Response.json({ error: 'Room is full' }, { status: 400 })
  }

  const playerId = generateId()
  room.players.push({ id: playerId, name: playerName, joinedAt: Date.now() })
  await kv.set(`room:${code}`, room, { ex: 7200 })

  return Response.json({ playerId, room })
}
```

- [ ] **Step 5: Create GET /api/ably/auth route**

Create `app/api/ably/auth/route.ts`:
```ts
import Ably from 'ably'

export async function GET(request: Request) {
  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Ably not configured' }, { status: 500 })
  }

  const url = new URL(request.url)
  const clientId = url.searchParams.get('clientId') || 'anonymous'

  const client = new Ably.Rest(apiKey)
  const tokenRequest = await client.auth.createTokenRequest({ clientId })

  return Response.json(tokenRequest)
}
```

- [ ] **Step 6: Verify dev server starts**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx next build 2>&1 | tail -5
```

Expected: no build errors related to API routes. (If Ably key is missing, that's a runtime issue, not build.)

- [ ] **Step 7: Commit**

```bash
git add app/lib/kv.ts app/api/ && git commit -m "feat: add KV store and API routes (rooms CRUD + Ably auth)"
```

---

### Task 5: Player Context & Ably Provider

**Files:**
- Create: `app/lib/player-context.tsx`
- Create: `app/lib/ably.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create player context**

Create `app/lib/player-context.tsx`:
```tsx
'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

type PlayerInfo = {
  id: string
  name: string
  roomCode: string
  isHost: boolean
}

type PlayerContextType = {
  player: PlayerInfo | null
  setPlayer: (info: PlayerInfo) => void
  clearPlayer: () => void
}

const PlayerContext = createContext<PlayerContextType | null>(null)

const STORAGE_KEY = 'pat-and-mat-player'

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayerState] = useState<PlayerInfo | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setPlayerState(JSON.parse(stored))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  const setPlayer = useCallback((info: PlayerInfo) => {
    setPlayerState(info)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
  }, [])

  const clearPlayer = useCallback(() => {
    setPlayerState(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <PlayerContext value={{ player, setPlayer, clearPlayer }}>
      {children}
    </PlayerContext>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
```

- [ ] **Step 2: Create Ably client helper**

Create `app/lib/ably.ts`:
```ts
import Ably from 'ably'

let ablyClient: Ably.Realtime | null = null

export function getAblyClient(clientId: string): Ably.Realtime {
  if (ablyClient) return ablyClient

  ablyClient = new Ably.Realtime({
    authUrl: '/api/ably/auth',
    authParams: { clientId },
  })

  return ablyClient
}

export function closeAblyClient() {
  if (ablyClient) {
    ablyClient.close()
    ablyClient = null
  }
}
```

- [ ] **Step 3: Update root layout with PlayerProvider**

Modify `app/layout.tsx` — replace the entire file:
```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { PlayerProvider } from './lib/player-context'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Pat and Mat',
  description: 'Real-time multiplayer Axis Split drawing game',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PlayerProvider>{children}</PlayerProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/lib/player-context.tsx app/lib/ably.ts app/layout.tsx && git commit -m "feat: add player context with localStorage and Ably client helper"
```

---

### Task 6: Home Page (Create / Join Room)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement home page**

Replace `app/page.tsx` with:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayer } from './lib/player-context'

export default function Home() {
  const router = useRouter()
  const { setPlayer } = usePlayer()
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return setError('Enter your name')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPlayer({
        id: data.playerId,
        name: name.trim(),
        roomCode: data.code,
        isHost: true,
      })
      router.push(`/room/${data.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('Enter your name')
    if (!joinCode.trim()) return setError('Enter a room code')
    setLoading(true)
    setError('')

    try {
      const code = joinCode.trim().toUpperCase()
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPlayer({
        id: data.playerId,
        name: name.trim(),
        roomCode: code,
        isHost: false,
      })
      router.push(`/room/${code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pat & Mat
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Axis Split Drawing Game
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-50"
          />

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create Room
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-sm text-zinc-400">or join</span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-center font-mono text-lg tracking-widest text-zinc-900 uppercase placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-50"
            />
            <button
              onClick={handleJoin}
              disabled={loading}
              className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Join
            </button>
          </div>
        </div>

        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx next dev &
```

Open `http://localhost:3000`. Verify:
- Name input, Create Room button, Join section visible
- Create Room creates a room and redirects to `/room/XXXX` (will be 404 for now, that's expected)

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx && git commit -m "feat: add home page with create/join room UI"
```

---

### Task 7: Lobby Page

**Files:**
- Create: `app/room/[code]/page.tsx`

- [ ] **Step 1: Create lobby page**

Create `app/room/[code]/page.tsx`:
```tsx
'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayer } from '@/app/lib/player-context'
import { getAblyClient } from '@/app/lib/ably'
import type { Player } from '@/app/lib/types'

export default function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = use(params)
  const router = useRouter()
  const { player } = usePlayer()
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState('')

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlayers(data.room.players)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room')
    }
  }, [code])

  useEffect(() => {
    if (!player) {
      router.push('/')
      return
    }

    fetchRoom()

    const ably = getAblyClient(player.id)
    const channel = ably.channels.get(`room:${code}`)

    channel.subscribe('player_joined', (msg) => {
      const newPlayer = msg.data as Player
      setPlayers((prev) => {
        if (prev.some((p) => p.id === newPlayer.id)) return prev
        return [...prev, newPlayer]
      })
    })

    channel.subscribe('game_start', () => {
      router.push(`/room/${code}/play`)
    })

    return () => {
      channel.unsubscribe()
    }
  }, [player, code, router, fetchRoom])

  function handleStart() {
    if (!player) return
    const ably = getAblyClient(player.id)
    const channel = ably.channels.get(`room:${code}`)
    channel.publish('game_start', {})
  }

  if (!player) return null

  const canStart = player.isHost && players.length >= 6

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm space-y-8 px-6 text-center">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Room Code</p>
          <p className="mt-1 font-mono text-5xl font-bold tracking-widest text-zinc-900 dark:text-zinc-50">
            {code}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Players ({players.length}/12)
          </p>
          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="text-zinc-900 dark:text-zinc-50">
                  {p.name}
                </span>
                {p.id === player.id && (
                  <span className="text-xs text-zinc-400">(you)</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {player.isHost ? (
          <div className="space-y-2">
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {players.length < 6
                ? `Need ${6 - players.length} more players`
                : 'Start Game'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Waiting for host to start...
          </p>
        )}

        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update join API route to publish player_joined event**

This step requires the joining player's info to be broadcast. Since the API route is server-side and Ably publish is lightweight, add it to the join route.

Modify `app/api/rooms/[code]/join/route.ts` — replace the entire file:
```ts
import Ably from 'ably'
import { kv } from '@/app/lib/kv'
import { generateId } from '@/app/lib/utils'
import type { Room, Player } from '@/app/lib/types'

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/rooms/[code]/join'>
) {
  const { code } = await ctx.params
  const body = await request.json()
  const { playerName } = body

  if (!playerName || typeof playerName !== 'string') {
    return Response.json({ error: 'playerName is required' }, { status: 400 })
  }

  const room = await kv.get<Room>(`room:${code}`)
  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.status !== 'waiting') {
    return Response.json({ error: 'Game already in progress' }, { status: 400 })
  }

  if (room.players.length >= 12) {
    return Response.json({ error: 'Room is full' }, { status: 400 })
  }

  const playerId = generateId()
  const newPlayer: Player = { id: playerId, name: playerName, joinedAt: Date.now() }
  room.players.push(newPlayer)
  await kv.set(`room:${code}`, room, { ex: 7200 })

  // Broadcast to lobby via Ably
  const apiKey = process.env.ABLY_API_KEY
  if (apiKey) {
    const ably = new Ably.Rest(apiKey)
    const channel = ably.channels.get(`room:${code}`)
    await channel.publish('player_joined', newPlayer)
  }

  return Response.json({ playerId, room })
}
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000`:
1. Enter name, Create Room → should redirect to lobby showing room code and your name
2. Open a second tab, enter a different name, paste the room code, Join → should appear in both tabs

- [ ] **Step 4: Commit**

```bash
git add app/room/ app/api/rooms/\[code\]/join/route.ts && git commit -m "feat: add lobby page with live player list and Ably presence"
```

---

### Task 8: Game Engine Hook

**Files:**
- Create: `app/lib/game-engine.ts`

- [ ] **Step 1: Implement useGameEngine hook**

Create `app/lib/game-engine.ts`:
```ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAblyClient } from './ably'
import { getPromptForRound, getDifficulty } from './prompts'
import { calculateTeamRoundScore, filterTrollVotes } from './scoring'
import { shuffleAndPair } from './utils'
import type {
  GameState,
  GamePhase,
  Team,
  Vote,
  Drawing,
  RoundStartEvent,
  RoundResultEvent,
  DrawingSubmitEvent,
  VoteEvent,
  GameEndEvent,
} from './types'

type UseGameEngineProps = {
  roomCode: string
  playerId: string
  isHost: boolean
  playerIds: string[]
}

const INITIAL_STATE: GameState = {
  round: 0,
  phase: 'results',
  teams: [],
  prompt: '',
  cumulativeScores: {},
  roundScores: {},
  drawings: {},
  votes: [],
}

export function useGameEngine({ roomCode, playerId, isHost, playerIds }: UseGameEngineProps) {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE)
  const [drawingTimeLeft, setDrawingTimeLeft] = useState(0)
  const [votingTimeLeft, setVotingTimeLeft] = useState(0)
  const [viewingTeamIndex, setViewingTeamIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>(null)
  const votesRef = useRef<Vote[]>([])
  const drawingsRef = useRef<Record<string, Drawing>>({})

  const ably = getAblyClient(playerId)
  const channel = ably.channels.get(`room:${roomCode}`)

  // Host: start a new round
  const startRound = useCallback((roundNumber: number) => {
    const teams = shuffleAndPair(playerIds)
    const prompt = getPromptForRound(roundNumber)
    const difficulty = getDifficulty(roundNumber)

    const event: RoundStartEvent = { round: roundNumber, difficulty, prompt, teams }
    channel.publish('round_start', event)
  }, [playerIds, channel])

  // Host: end drawing phase
  const endDrawing = useCallback(() => {
    channel.publish('drawing_end', { round: gameState.round })
  }, [channel, gameState.round])

  // Host: start voting
  const startVoting = useCallback(() => {
    channel.publish('vote_start', { teams: gameState.teams })
  }, [channel, gameState.teams])

  // Any player: submit drawing
  const submitDrawing = useCallback((teamId: string, drawing: Drawing) => {
    const event: DrawingSubmitEvent = { teamId, drawing }
    channel.publish('drawing_submit', event)
  }, [channel])

  // Any player: submit vote
  const submitVote = useCallback((teamId: string, vote: 'good' | 'bad') => {
    const event: VoteEvent = { voterId: playerId, teamId, vote }
    channel.publish('vote', event)
  }, [channel, playerId])

  // Host: advance viewing to next team or to voting
  const nextViewing = useCallback(() => {
    const nextIndex = viewingTeamIndex + 1
    if (nextIndex >= gameState.teams.length) {
      startVoting()
    } else {
      setViewingTeamIndex(nextIndex)
      channel.publish('viewing_next', { teamIndex: nextIndex })
    }
  }, [viewingTeamIndex, gameState.teams.length, startVoting, channel])

  // Host: calculate results and broadcast
  const calculateResults = useCallback(() => {
    const cleanVotes = filterTrollVotes(votesRef.current)
    const roundScores: Record<string, number> = {}
    const bonusTeams: string[] = []

    for (const team of gameState.teams) {
      const score = calculateTeamRoundScore(cleanVotes, team.id, gameState.round)
      roundScores[team.id] = score

      const teamVotes = cleanVotes.filter((v) => v.teamId === team.id)
      const good = teamVotes.filter((v) => v.vote === 'good').length
      if (teamVotes.length > 0 && good / teamVotes.length >= 0.7) {
        bonusTeams.push(team.id)
      }
    }

    const cumulativeScores = { ...gameState.cumulativeScores }
    for (const [teamId, score] of Object.entries(roundScores)) {
      cumulativeScores[teamId] = (cumulativeScores[teamId] || 0) + score
    }

    const event: RoundResultEvent = {
      round: gameState.round,
      roundScores,
      cumulativeScores,
      bonusTeams,
    }
    channel.publish('round_result', event)
  }, [gameState.teams, gameState.round, gameState.cumulativeScores, channel])

  // Host: end the game
  const endGame = useCallback(() => {
    const sorted = Object.entries(gameState.cumulativeScores).sort(
      ([, a], [, b]) => b - a
    )
    const winnerTeamId = sorted[0]?.[0] || ''

    // Calculate MVP: player whose teams got most good votes
    const playerGoodVotes: Record<string, number> = {}
    for (const vote of votesRef.current) {
      if (vote.vote !== 'good') continue
      const team = gameState.teams.find((t) => t.id === vote.teamId)
      if (!team) continue
      playerGoodVotes[team.player1Id] = (playerGoodVotes[team.player1Id] || 0) + 1
      playerGoodVotes[team.player2Id] = (playerGoodVotes[team.player2Id] || 0) + 1
    }
    const mvpPlayerId = Object.entries(playerGoodVotes).sort(
      ([, a], [, b]) => b - a
    )[0]?.[0] || ''

    const event: GameEndEvent = {
      finalScores: gameState.cumulativeScores,
      winnerTeamId,
      mvpPlayerId,
      playerGoodVotes,
    }
    channel.publish('game_end', event)
  }, [gameState.cumulativeScores, gameState.teams, channel])

  // Host: next round or end game
  const nextRound = useCallback(() => {
    if (gameState.round >= 5) {
      endGame()
    } else {
      startRound(gameState.round + 1)
    }
  }, [gameState.round, startRound, endGame])

  // Start game (round 1)
  const startGame = useCallback(() => {
    startRound(1)
  }, [startRound])

  // Subscribe to all game events
  useEffect(() => {
    channel.subscribe('round_start', (msg) => {
      const data = msg.data as RoundStartEvent
      votesRef.current = []
      drawingsRef.current = {}
      setViewingTeamIndex(0)
      setGameState((prev) => ({
        ...prev,
        round: data.round,
        phase: 'drawing',
        teams: data.teams,
        prompt: data.prompt,
        drawings: {},
        votes: [],
        roundScores: {},
      }))
      setDrawingTimeLeft(25)
    })

    channel.subscribe('drawing_end', () => {
      setGameState((prev) => ({ ...prev, phase: 'viewing' }))
      setDrawingTimeLeft(0)
    })

    channel.subscribe('drawing_submit', (msg) => {
      const data = msg.data as DrawingSubmitEvent
      drawingsRef.current[data.teamId] = data.drawing
      setGameState((prev) => ({
        ...prev,
        drawings: { ...prev.drawings, [data.teamId]: data.drawing },
      }))
    })

    channel.subscribe('viewing_next', (msg) => {
      setViewingTeamIndex(msg.data.teamIndex)
    })

    channel.subscribe('vote_start', () => {
      setGameState((prev) => ({ ...prev, phase: 'voting' }))
      setVotingTimeLeft(10)
    })

    channel.subscribe('vote', (msg) => {
      const data = msg.data as VoteEvent
      votesRef.current.push(data)
      setGameState((prev) => ({
        ...prev,
        votes: [...prev.votes, data],
      }))
    })

    channel.subscribe('round_result', (msg) => {
      const data = msg.data as RoundResultEvent
      setGameState((prev) => ({
        ...prev,
        phase: 'results',
        roundScores: data.roundScores,
        cumulativeScores: data.cumulativeScores,
      }))
      setVotingTimeLeft(0)
    })

    return () => {
      channel.unsubscribe()
    }
  }, [channel])

  // Drawing timer
  useEffect(() => {
    if (drawingTimeLeft <= 0) return
    timerRef.current = setInterval(() => {
      setDrawingTimeLeft((prev) => {
        if (prev <= 1) {
          if (isHost) endDrawing()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [drawingTimeLeft > 0, isHost, endDrawing])

  // Voting timer
  useEffect(() => {
    if (votingTimeLeft <= 0) return
    const interval = setInterval(() => {
      setVotingTimeLeft((prev) => {
        if (prev <= 1) {
          if (isHost) calculateResults()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [votingTimeLeft > 0, isHost, calculateResults])

  return {
    gameState,
    drawingTimeLeft,
    votingTimeLeft,
    viewingTeamIndex,
    startGame,
    nextRound,
    nextViewing,
    submitDrawing,
    submitVote,
    endDrawing,
    startVoting,
    calculateResults,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/game-engine.ts && git commit -m "feat: add game engine hook with state machine and Ably events"
```

---

### Task 9: Drawing Canvas (Axis Split)

**Files:**
- Create: `app/room/[code]/play/components/drawing-canvas.tsx`

- [ ] **Step 1: Implement the Axis Split drawing canvas**

Create `app/room/[code]/play/components/drawing-canvas.tsx`:
```tsx
'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { getAblyClient } from '@/app/lib/ably'
import type { Stroke, Drawing, Point } from '@/app/lib/types'

type DrawingCanvasProps = {
  roomCode: string
  teamId: string
  playerId: string
  axis: 'x' | 'y'
  timeLeft: number
  onDrawingComplete: (drawing: Drawing) => void
}

const CANVAS_SIZE = 400

export default function DrawingCanvas({
  roomCode,
  teamId,
  playerId,
  axis,
  timeLeft,
  onDrawingComplete,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const currentStrokeRef = useRef<Point[]>([])
  const myPosRef = useRef({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 })
  const partnerPosRef = useRef({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 })
  const myPenDownRef = useRef(false)
  const partnerPenDownRef = useRef(false)
  const [penPos, setPenPos] = useState({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 })
  const rafRef = useRef<number>(0)

  const ably = getAblyClient(playerId)
  const teamChannel = ably.channels.get(`room:${roomCode}:team:${teamId}`)

  const bothDown = useCallback(() => {
    return myPenDownRef.current && partnerPenDownRef.current
  }, [])

  const getCurrentPos = useCallback(() => {
    if (axis === 'x') {
      return { x: myPosRef.current.x, y: partnerPosRef.current.y }
    }
    return { x: partnerPosRef.current.x, y: myPosRef.current.y }
  }, [axis])

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw completed strokes
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y)
      }
      ctx.stroke()
    }

    // Draw current stroke
    const current = currentStrokeRef.current
    if (current.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(current[0].x, current[0].y)
      for (let i = 1; i < current.length; i++) {
        ctx.lineTo(current[i].x, current[i].y)
      }
      ctx.stroke()
    }

    // Draw cursor dot
    const pos = getCurrentPos()
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = bothDown() ? '#000000' : '#aaaaaa'
    ctx.fill()

    rafRef.current = requestAnimationFrame(render)
  }, [getCurrentPos, bothDown])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [render])

  // Subscribe to partner events
  useEffect(() => {
    const moveEvent = axis === 'x' ? 'move_y' : 'move_x'

    teamChannel.subscribe(moveEvent, (msg) => {
      if (axis === 'x') {
        partnerPosRef.current.y = msg.data.value
      } else {
        partnerPosRef.current.x = msg.data.value
      }

      const pos = getCurrentPos()
      setPenPos(pos)

      if (bothDown()) {
        currentStrokeRef.current.push({ x: pos.x, y: pos.y, t: Date.now() })
      }
    })

    teamChannel.subscribe('pen_down', (msg) => {
      if (msg.data.playerId !== playerId) {
        partnerPenDownRef.current = true
      }
    })

    teamChannel.subscribe('pen_up', (msg) => {
      if (msg.data.playerId !== playerId) {
        partnerPenDownRef.current = false
        if (currentStrokeRef.current.length > 0) {
          strokesRef.current.push([...currentStrokeRef.current])
          currentStrokeRef.current = []
        }
      }
    })

    return () => {
      teamChannel.unsubscribe()
    }
  }, [teamChannel, axis, playerId, getCurrentPos, bothDown])

  // Submit drawing when time runs out
  useEffect(() => {
    if (timeLeft === 0) {
      if (currentStrokeRef.current.length > 0) {
        strokesRef.current.push([...currentStrokeRef.current])
        currentStrokeRef.current = []
      }
      // Only player1 (x-axis) submits to avoid duplicates
      if (axis === 'x') {
        onDrawingComplete([...strokesRef.current])
      }
    }
  }, [timeLeft, axis, onDrawingComplete])

  function handlePointerMove(e: React.PointerEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height

    if (axis === 'x') {
      const x = Math.max(0, Math.min(CANVAS_SIZE, (e.clientX - rect.left) * scaleX))
      myPosRef.current.x = x
      teamChannel.publish('move_x', { value: x })
    } else {
      const y = Math.max(0, Math.min(CANVAS_SIZE, (e.clientY - rect.top) * scaleY))
      myPosRef.current.y = y
      teamChannel.publish('move_y', { value: y })
    }

    const pos = getCurrentPos()
    setPenPos(pos)

    if (bothDown()) {
      currentStrokeRef.current.push({ x: pos.x, y: pos.y, t: Date.now() })
    }
  }

  function handlePointerDown() {
    myPenDownRef.current = true
    teamChannel.publish('pen_down', { playerId })
  }

  function handlePointerUp() {
    myPenDownRef.current = false
    teamChannel.publish('pen_up', { playerId })
    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current])
      currentStrokeRef.current = []
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-[400px]">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          You control: <span className="font-bold text-zinc-900 dark:text-zinc-50">{axis.toUpperCase()}-axis</span>
        </span>
        <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {timeLeft}s
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="rounded-lg border-2 border-zinc-300 dark:border-zinc-700 touch-none cursor-crosshair"
        style={{ width: '100%', maxWidth: CANVAS_SIZE }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <p className="text-xs text-zinc-400">
        Both players must press and hold to draw
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/room/\[code\]/play/components/ && git commit -m "feat: add Axis Split drawing canvas with real-time Ably sync"
```

---

### Task 10: Stroke Replay Component

**Files:**
- Create: `app/room/[code]/play/components/stroke-replay.tsx`

- [ ] **Step 1: Implement stroke replay animation**

Create `app/room/[code]/play/components/stroke-replay.tsx`:
```tsx
'use client'

import { useRef, useEffect } from 'react'
import type { Drawing } from '@/app/lib/types'

type StrokeReplayProps = {
  drawing: Drawing
  size?: number
  animate?: boolean
}

const DEFAULT_SIZE = 300

export default function StrokeReplay({
  drawing,
  size = DEFAULT_SIZE,
  animate = true,
}: StrokeReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    if (!drawing || drawing.length === 0) return

    if (!animate) {
      drawAll(ctx, drawing, size)
      return
    }

    // Flatten all points for animation
    const allPoints: { x: number; y: number; strokeIndex: number }[] = []
    for (let s = 0; s < drawing.length; s++) {
      for (const point of drawing[s]) {
        allPoints.push({ x: point.x, y: point.y, strokeIndex: s })
      }
    }

    if (allPoints.length === 0) return

    let pointIndex = 0
    const scale = size / 400 // drawings are 400x400

    const interval = setInterval(() => {
      if (pointIndex >= allPoints.length) {
        clearInterval(interval)
        return
      }

      // Draw a batch of points per frame
      const batchSize = Math.max(1, Math.floor(allPoints.length / 60))
      const end = Math.min(pointIndex + batchSize, allPoints.length)

      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3 * scale
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (let i = pointIndex; i < end; i++) {
        const p = allPoints[i]
        const prev = i > 0 ? allPoints[i - 1] : null

        if (!prev || prev.strokeIndex !== p.strokeIndex) {
          ctx.beginPath()
          ctx.moveTo(p.x * scale, p.y * scale)
        } else {
          ctx.beginPath()
          ctx.moveTo(prev.x * scale, prev.y * scale)
          ctx.lineTo(p.x * scale, p.y * scale)
          ctx.stroke()
        }
      }

      pointIndex = end
    }, 16)

    return () => clearInterval(interval)
  }, [drawing, size, animate])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-lg border border-zinc-200 dark:border-zinc-800"
      style={{ width: '100%', maxWidth: size }}
    />
  )
}

function drawAll(ctx: CanvasRenderingContext2D, drawing: Drawing, size: number) {
  const scale = size / 400
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 3 * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const stroke of drawing) {
    if (stroke.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(stroke[0].x * scale, stroke[0].y * scale)
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x * scale, stroke[i].y * scale)
    }
    ctx.stroke()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/room/\[code\]/play/components/stroke-replay.tsx && git commit -m "feat: add stroke replay component with animation"
```

---

### Task 11: Voting Phase Component

**Files:**
- Create: `app/room/[code]/play/components/voting-phase.tsx`

- [ ] **Step 1: Implement voting UI**

Create `app/room/[code]/play/components/voting-phase.tsx`:
```tsx
'use client'

import { useState, useMemo } from 'react'
import StrokeReplay from './stroke-replay'
import type { Team, Drawing } from '@/app/lib/types'

type VotingPhaseProps = {
  teams: Team[]
  drawings: Record<string, Drawing>
  playerId: string
  timeLeft: number
  onVote: (teamId: string, vote: 'good' | 'bad') => void
}

export default function VotingPhase({
  teams,
  drawings,
  playerId,
  timeLeft,
  onVote,
}: VotingPhaseProps) {
  const [votedTeams, setVotedTeams] = useState<Set<string>>(new Set())

  const otherTeams = useMemo(
    () => teams.filter((t) => t.player1Id !== playerId && t.player2Id !== playerId),
    [teams, playerId]
  )

  function handleVote(teamId: string, vote: 'good' | 'bad') {
    if (votedTeams.has(teamId)) return
    setVotedTeams((prev) => new Set(prev).add(teamId))
    onVote(teamId, vote)
  }

  const allVoted = otherTeams.every((t) => votedTeams.has(t.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Vote!</h2>
        <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {timeLeft}s
        </span>
      </div>

      {allVoted ? (
        <p className="text-center text-zinc-500 dark:text-zinc-400">
          All votes submitted! Waiting for results...
        </p>
      ) : (
        <div className="grid gap-6">
          {otherTeams.map((team) => {
            const drawing = drawings[team.id] || []
            const hasVoted = votedTeams.has(team.id)

            return (
              <div
                key={team.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex justify-center">
                  <StrokeReplay drawing={drawing} size={250} animate={false} />
                </div>
                <div className="mt-4 flex justify-center gap-4">
                  {hasVoted ? (
                    <p className="text-sm text-zinc-400">Voted!</p>
                  ) : (
                    <>
                      <button
                        onClick={() => handleVote(team.id, 'good')}
                        className="flex items-center gap-2 rounded-lg bg-green-500 px-6 py-2 font-medium text-white transition-colors hover:bg-green-600"
                      >
                        <span className="text-lg">👍</span> Good
                      </button>
                      <button
                        onClick={() => handleVote(team.id, 'bad')}
                        className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2 font-medium text-white transition-colors hover:bg-red-600"
                      >
                        <span className="text-lg">👎</span> Bad
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/room/\[code\]/play/components/voting-phase.tsx && git commit -m "feat: add voting phase component with thumbs up/down UI"
```

---

### Task 12: Results & Final Screen Components

**Files:**
- Create: `app/room/[code]/play/components/results-phase.tsx`
- Create: `app/room/[code]/play/components/final-results.tsx`
- Create: `app/room/[code]/play/components/scoreboard.tsx`

- [ ] **Step 1: Create scoreboard component**

Create `app/room/[code]/play/components/scoreboard.tsx`:
```tsx
import type { Team } from '@/app/lib/types'

type ScoreboardProps = {
  teams: Team[]
  cumulativeScores: Record<string, number>
  roundScores?: Record<string, number>
  playerNames: Record<string, string>
}

export default function Scoreboard({
  teams,
  cumulativeScores,
  roundScores,
  playerNames,
}: ScoreboardProps) {
  const sorted = [...teams].sort(
    (a, b) => (cumulativeScores[b.id] || 0) - (cumulativeScores[a.id] || 0)
  )

  return (
    <div className="space-y-2">
      {sorted.map((team, i) => {
        const p1Name = playerNames[team.player1Id] || 'Player 1'
        const p2Name = playerNames[team.player2Id] || 'Player 2'
        const total = cumulativeScores[team.id] || 0
        const round = roundScores?.[team.id]

        return (
          <div
            key={team.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-zinc-400">#{i + 1}</span>
              <span className="text-zinc-900 dark:text-zinc-50">
                {p1Name} & {p2Name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {round !== undefined && (
                <span className="text-sm text-green-500">+{round}</span>
              )}
              <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {total}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create results phase component**

Create `app/room/[code]/play/components/results-phase.tsx`:
```tsx
import Scoreboard from './scoreboard'
import type { Team } from '@/app/lib/types'

type ResultsPhaseProps = {
  round: number
  teams: Team[]
  cumulativeScores: Record<string, number>
  roundScores: Record<string, number>
  playerNames: Record<string, string>
  isHost: boolean
  onNextRound: () => void
}

export default function ResultsPhase({
  round,
  teams,
  cumulativeScores,
  roundScores,
  playerNames,
  isHost,
  onNextRound,
}: ResultsPhaseProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Round {round} Results
      </h2>

      <Scoreboard
        teams={teams}
        cumulativeScores={cumulativeScores}
        roundScores={roundScores}
        playerNames={playerNames}
      />

      {isHost && (
        <button
          onClick={onNextRound}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {round >= 5 ? 'See Final Results' : `Start Round ${round + 1}`}
        </button>
      )}

      {!isHost && (
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Waiting for host to continue...
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create final results component**

Create `app/room/[code]/play/components/final-results.tsx`:
```tsx
'use client'

import { useRouter } from 'next/navigation'
import Scoreboard from './scoreboard'
import type { Team, GameEndEvent } from '@/app/lib/types'

type FinalResultsProps = {
  teams: Team[]
  endEvent: GameEndEvent
  playerNames: Record<string, string>
  playerId: string
  isHost: boolean
  roomCode: string
}

export default function FinalResults({
  teams,
  endEvent,
  playerNames,
  playerId,
  isHost,
  roomCode,
}: FinalResultsProps) {
  const router = useRouter()
  const { finalScores, winnerTeamId, mvpPlayerId, playerGoodVotes } = endEvent

  const winnerTeam = teams.find((t) => t.id === winnerTeamId)
  const mvpName = playerNames[mvpPlayerId] || 'Unknown'
  const myGoodVotes = playerGoodVotes[playerId] || 0

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Game Over!
        </h2>
        {winnerTeam && (
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            Winners:{' '}
            <span className="font-bold text-zinc-900 dark:text-zinc-50">
              {playerNames[winnerTeam.player1Id]} &{' '}
              {playerNames[winnerTeam.player2Id]}
            </span>
          </p>
        )}
      </div>

      <Scoreboard
        teams={teams}
        cumulativeScores={finalScores}
        playerNames={playerNames}
      />

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">MVP</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-50">
            {mvpName}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Your 👍 votes</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-50">
            {myGoodVotes}
          </span>
        </div>
      </div>

      {isHost && (
        <button
          onClick={() => router.push(`/room/${roomCode}`)}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Play Again
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/room/\[code\]/play/components/results-phase.tsx app/room/\[code\]/play/components/final-results.tsx app/room/\[code\]/play/components/scoreboard.tsx && git commit -m "feat: add results, final results, and scoreboard components"
```

---

### Task 13: Game Page (Orchestrator)

**Files:**
- Create: `app/room/[code]/play/page.tsx`

- [ ] **Step 1: Implement the game page that ties all phases together**

Create `app/room/[code]/play/page.tsx`:
```tsx
'use client'

import { use, useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayer } from '@/app/lib/player-context'
import { useGameEngine } from '@/app/lib/game-engine'
import { getAblyClient } from '@/app/lib/ably'
import DrawingCanvas from './components/drawing-canvas'
import StrokeReplay from './components/stroke-replay'
import VotingPhase from './components/voting-phase'
import ResultsPhase from './components/results-phase'
import FinalResults from './components/final-results'
import type { Player, GameEndEvent } from '@/app/lib/types'

export default function PlayPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = use(params)
  const router = useRouter()
  const { player } = usePlayer()
  const [players, setPlayers] = useState<Player[]>([])
  const [gameEnded, setGameEnded] = useState(false)
  const [endEvent, setEndEvent] = useState<GameEndEvent | null>(null)

  // Fetch room players
  useEffect(() => {
    if (!player) {
      router.push('/')
      return
    }
    fetch(`/api/rooms/${code}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.room) setPlayers(data.room.players)
      })
  }, [code, player, router])

  const playerIds = useMemo(() => players.map((p) => p.id), [players])
  const playerNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of players) map[p.id] = p.name
    return map
  }, [players])

  const {
    gameState,
    drawingTimeLeft,
    votingTimeLeft,
    viewingTeamIndex,
    startGame,
    nextRound,
    nextViewing,
    submitDrawing,
    submitVote,
  } = useGameEngine({
    roomCode: code,
    playerId: player?.id || '',
    isHost: player?.isHost || false,
    playerIds,
  })

  // Listen for game_end
  useEffect(() => {
    if (!player) return
    const ably = getAblyClient(player.id)
    const channel = ably.channels.get(`room:${code}`)

    channel.subscribe('game_end', (msg) => {
      setEndEvent(msg.data as GameEndEvent)
      setGameEnded(true)
    })

    return () => {
      channel.unsubscribe('game_end')
    }
  }, [code, player])

  // Start game when page loads (host)
  useEffect(() => {
    if (player?.isHost && playerIds.length >= 6 && gameState.round === 0) {
      startGame()
    }
  }, [player?.isHost, playerIds.length, gameState.round, startGame])

  const handleDrawingComplete = useCallback(
    (drawing: import('@/app/lib/types').Drawing) => {
      const myTeam = gameState.teams.find(
        (t) => t.player1Id === player?.id || t.player2Id === player?.id
      )
      if (myTeam) {
        submitDrawing(myTeam.id, drawing)
      }
    },
    [gameState.teams, player?.id, submitDrawing]
  )

  if (!player) return null

  // Game ended
  if (gameEnded && endEvent) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md px-6 py-8">
          <FinalResults
            teams={gameState.teams}
            endEvent={endEvent}
            playerNames={playerNames}
            playerId={player.id}
            isHost={player.isHost}
            roomCode={code}
          />
        </div>
      </div>
    )
  }

  // Waiting for game to start
  if (gameState.round === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500 dark:text-zinc-400">Starting game...</p>
      </div>
    )
  }

  const myTeam = gameState.teams.find(
    (t) => t.player1Id === player.id || t.player2Id === player.id
  )
  const myAxis = myTeam?.player1Id === player.id ? 'x' : 'y'

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md px-6 py-8">
        {/* Round & prompt header */}
        <div className="mb-6 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Round {gameState.round}/5
          </p>
          <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {gameState.prompt}
          </h2>
        </div>

        {/* Drawing phase */}
        {gameState.phase === 'drawing' && myTeam && (
          <DrawingCanvas
            roomCode={code}
            teamId={myTeam.id}
            playerId={player.id}
            axis={myAxis as 'x' | 'y'}
            timeLeft={drawingTimeLeft}
            onDrawingComplete={handleDrawingComplete}
          />
        )}

        {gameState.phase === 'drawing' && !myTeam && (
          <div className="text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              Sitting this round out (odd player count)
            </p>
            <p className="mt-2 font-mono text-lg text-zinc-900 dark:text-zinc-50">
              {drawingTimeLeft}s
            </p>
          </div>
        )}

        {/* Viewing phase */}
        {gameState.phase === 'viewing' && (
          <div className="space-y-4">
            <h2 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Team {viewingTeamIndex + 1} of {gameState.teams.length}
            </h2>
            {gameState.teams[viewingTeamIndex] && (
              <div className="flex justify-center">
                <StrokeReplay
                  drawing={
                    gameState.drawings[gameState.teams[viewingTeamIndex].id] || []
                  }
                  size={350}
                  animate={true}
                />
              </div>
            )}
            {player.isHost && (
              <button
                onClick={nextViewing}
                className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {viewingTeamIndex + 1 >= gameState.teams.length
                  ? 'Start Voting'
                  : 'Next Drawing'}
              </button>
            )}
          </div>
        )}

        {/* Voting phase */}
        {gameState.phase === 'voting' && (
          <VotingPhase
            teams={gameState.teams}
            drawings={gameState.drawings}
            playerId={player.id}
            timeLeft={votingTimeLeft}
            onVote={submitVote}
          />
        )}

        {/* Results phase */}
        {gameState.phase === 'results' && gameState.round > 0 && (
          <ResultsPhase
            round={gameState.round}
            teams={gameState.teams}
            cumulativeScores={gameState.cumulativeScores}
            roundScores={gameState.roundScores}
            playerNames={playerNames}
            isHost={player.isHost}
            onNextRound={nextRound}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify dev server builds**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx next build 2>&1 | tail -10
```

Expected: no TypeScript or build errors

- [ ] **Step 3: Commit**

```bash
git add app/room/\[code\]/play/page.tsx && git commit -m "feat: add game page orchestrating all phases (drawing, viewing, voting, results)"
```

---

### Task 14: Run All Tests & Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx vitest run
```

Expected: all tests pass

- [ ] **Step 2: Run build**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx next build 2>&1 | tail -20
```

Expected: build succeeds with no errors

- [ ] **Step 3: Verify dev server manually**

```bash
cd /Users/temkanibno/Desktop/pat-and-mat && npx next dev &
```

Open `http://localhost:3000` and verify:
1. Home page renders with name input, create/join UI
2. Creating a room redirects to lobby with room code displayed
3. All pages load without console errors

Note: full multiplayer testing requires a valid `ABLY_API_KEY` in `.env.local`.

- [ ] **Step 4: Commit any fixes if needed**

Only commit if the verification steps above revealed issues that needed fixing.
