import { describe, it, expect } from 'vitest'
import { calculateTeamRoundScore, detectTrolls } from '@/app/lib/scoring'
import type { Vote } from '@/app/lib/types'

describe('calculateTeamRoundScore', () => {
  it('returns 0 when no votes', () => {
    expect(calculateTeamRoundScore([], 'team-0', 1)).toBe(0)
  })

  it('returns 10 + 2 bonus when all good votes', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'good' },
      { voterId: 'p3', teamId: 'team-0', vote: 'good' },
    ]
    expect(calculateTeamRoundScore(votes, 'team-0', 1)).toBe(12)
  })

  it('returns 0 when all bad votes', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'bad' },
      { voterId: 'p2', teamId: 'team-0', vote: 'bad' },
    ]
    expect(calculateTeamRoundScore(votes, 'team-0', 1)).toBe(0)
  })

  it('calculates normalized score for mixed votes', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'good' },
      { voterId: 'p3', teamId: 'team-0', vote: 'bad' },
      { voterId: 'p4', teamId: 'team-0', vote: 'bad' },
    ]
    expect(calculateTeamRoundScore(votes, 'team-0', 1)).toBe(5)
  })

  it('adds +2 bonus when >= 70% good', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'good' },
      { voterId: 'p3', teamId: 'team-0', vote: 'good' },
      { voterId: 'p4', teamId: 'team-0', vote: 'bad' },
    ]
    expect(calculateTeamRoundScore(votes, 'team-0', 1)).toBe(10)
  })

  it('doubles score in round 5', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'bad' },
    ]
    expect(calculateTeamRoundScore(votes, 'team-0', 5)).toBe(10)
  })

  it('doubles score including bonus in round 5', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-0', vote: 'good' },
      { voterId: 'p3', teamId: 'team-0', vote: 'good' },
      { voterId: 'p4', teamId: 'team-0', vote: 'bad' },
    ]
    expect(calculateTeamRoundScore(votes, 'team-0', 5)).toBe(20)
  })

  it('ignores votes for other teams', () => {
    const votes: Vote[] = [
      { voterId: 'p1', teamId: 'team-0', vote: 'good' },
      { voterId: 'p2', teamId: 'team-1', vote: 'bad' },
    ]
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
    expect(detectTrolls(votes)).toEqual([])
  })
})
