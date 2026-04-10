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
