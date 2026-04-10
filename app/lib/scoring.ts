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
