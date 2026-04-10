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
