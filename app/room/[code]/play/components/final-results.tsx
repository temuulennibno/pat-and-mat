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
