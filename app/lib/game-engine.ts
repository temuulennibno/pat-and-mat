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
