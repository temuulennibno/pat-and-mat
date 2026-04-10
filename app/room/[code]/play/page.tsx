'use client'

import { use, useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayer } from '@/app/lib/player-context'
import { useGameEngine } from '@/app/lib/game-engine'
import { getAblyClient } from '@/app/lib/ably'
import StrokeReplay from './components/stroke-replay'
import DrawingCanvas from './components/drawing-canvas'
import VotingPhase from './components/voting-phase'
import ResultsPhase from './components/results-phase'
import FinalResults from './components/final-results'
import type { Player, GameEndEvent, Drawing } from '@/app/lib/types'

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

  // Host auto-starts game
  useEffect(() => {
    if (player?.isHost && playerIds.length >= 4 && gameState.round === 0) {
      startGame()
    }
  }, [player?.isHost, playerIds.length, gameState.round, startGame])

  const handleDrawingComplete = useCallback(
    (drawing: Drawing) => {
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

  const isHost = player.isHost
  const myTeam = isHost
    ? null
    : gameState.teams.find(
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
            {isHost && ' — Spectating'}
          </p>
          <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {gameState.prompt}
          </h2>
        </div>

        {/* HOST SPECTATOR VIEW */}
        {isHost && gameState.phase === 'drawing' && (
          <div className="space-y-4 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              {gameState.teams.length} teams are drawing...
            </p>
            <p className="font-mono text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {drawingTimeLeft}s
            </p>
          </div>
        )}

        {isHost && gameState.phase === 'viewing' && (
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
            <button
              onClick={nextViewing}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {viewingTeamIndex + 1 >= gameState.teams.length
                ? 'Start Voting'
                : 'Next Drawing'}
            </button>
          </div>
        )}

        {isHost && gameState.phase === 'voting' && (
          <div className="space-y-4 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">Players are voting...</p>
            <p className="font-mono text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {votingTimeLeft}s
            </p>
          </div>
        )}

        {isHost && gameState.phase === 'results' && gameState.round > 0 && (
          <ResultsPhase
            round={gameState.round}
            teams={gameState.teams}
            cumulativeScores={gameState.cumulativeScores}
            roundScores={gameState.roundScores}
            playerNames={playerNames}
            isHost={true}
            onNextRound={nextRound}
          />
        )}

        {/* PLAYER VIEW */}
        {!isHost && gameState.phase === 'drawing' && myTeam && (
          <DrawingCanvas
            roomCode={code}
            teamId={myTeam.id}
            playerId={player.id}
            axis={myAxis as 'x' | 'y'}
            timeLeft={drawingTimeLeft}
            onDrawingComplete={handleDrawingComplete}
          />
        )}

        {!isHost && gameState.phase === 'drawing' && !myTeam && (
          <div className="text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              Sitting this round out (odd player count)
            </p>
            <p className="mt-2 font-mono text-lg text-zinc-900 dark:text-zinc-50">
              {drawingTimeLeft}s
            </p>
          </div>
        )}

        {!isHost && gameState.phase === 'viewing' && (
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
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              Waiting for host...
            </p>
          </div>
        )}

        {!isHost && gameState.phase === 'voting' && (
          <VotingPhase
            teams={gameState.teams}
            drawings={gameState.drawings}
            playerId={player.id}
            timeLeft={votingTimeLeft}
            onVote={submitVote}
          />
        )}

        {!isHost && gameState.phase === 'results' && gameState.round > 0 && (
          <ResultsPhase
            round={gameState.round}
            teams={gameState.teams}
            cumulativeScores={gameState.cumulativeScores}
            roundScores={gameState.roundScores}
            playerNames={playerNames}
            isHost={false}
            onNextRound={nextRound}
          />
        )}
      </div>
    </div>
  )
}
