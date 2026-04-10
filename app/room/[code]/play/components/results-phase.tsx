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
