'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayer } from '@/app/lib/player-context'
import { getAblyClient } from '@/app/lib/ably'
import type { Player } from '@/app/lib/types'

const BASE_URL = 'https://pat-and-mat-pi.vercel.app'

export default function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = use(params)
  const router = useRouter()
  const { player, setPlayer } = usePlayer()
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)

  const joinUrl = `${BASE_URL}/room/${code}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`

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
    fetchRoom()
    if (!player) return

    const interval = setInterval(fetchRoom, 3000)

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
      clearInterval(interval)
      channel.unsubscribe()
    }
  }, [player, code, router, fetchRoom])

  async function handleJoinFromQR() {
    if (!joinName.trim()) return setError('Enter your name')
    setJoining(true)
    setError('')

    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: joinName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPlayer({
        id: data.playerId,
        name: joinName.trim(),
        roomCode: code,
        isHost: false,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setJoining(false)
    }
  }

  function handleStart() {
    if (!player) return
    const ably = getAblyClient(player.id)
    const channel = ably.channels.get(`room:${code}`)
    channel.publish('game_start', {})
  }

  // Player hasn't joined yet (came from QR code)
  if (!player) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-sm space-y-6 px-6 text-center">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Join Room
            </h1>
            <p className="mt-1 font-mono text-4xl font-bold tracking-widest text-zinc-900 dark:text-zinc-50">
              {code}
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              maxLength={20}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-4 text-center text-lg text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-50"
            />

            <button
              onClick={handleJoinFromQR}
              disabled={joining}
              className="w-full rounded-xl bg-zinc-900 px-4 py-4 text-lg font-bold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Join Game
            </button>
          </div>

          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}
        </div>
      </div>
    )
  }

  const MIN_PLAYERS = 4
  const canStart = player.isHost && players.length >= MIN_PLAYERS

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          {/* Room code */}
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Room Code</p>
            <p className="mt-1 font-mono text-5xl font-bold tracking-widest text-zinc-900 dark:text-zinc-50">
              {code}
            </p>
          </div>

          {/* QR Code (host only) */}
          {player.isHost && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={qrUrl}
                alt={`QR code to join room ${code}`}
                width={160}
                height={160}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800"
              />
              <p className="text-xs text-zinc-400">Scan to join</p>
            </div>
          )}

          {/* Player list */}
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
              {players.length === 0 && (
                <p className="py-4 text-sm text-zinc-400">
                  Waiting for players to join...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 w-full border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto max-w-sm">
          {player.isHost ? (
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full rounded-xl bg-zinc-900 px-4 py-4 text-lg font-bold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {players.length < MIN_PLAYERS
                ? `Need ${MIN_PLAYERS - players.length} more players`
                : 'Start Game'}
            </button>
          ) : (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              Waiting for host to start...
            </p>
          )}

          {error && (
            <p className="mt-2 text-center text-sm text-red-500">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
