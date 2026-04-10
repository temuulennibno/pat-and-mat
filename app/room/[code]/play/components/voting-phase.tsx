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
