'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayer } from '@/app/lib/player-context'
import { getAblyClient } from '@/app/lib/ably'
import type { Player } from '@/app/lib/types'

export default function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = use(params)
  const router = useRouter()
  const { player } = usePlayer()
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState('')

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
    if (!player) {
      router.push('/')
      return
    }

    fetchRoom()
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

  function handleStart() {
    if (!player) return
    const ably = getAblyClient(player.id)
    const channel = ably.channels.get(`room:${code}`)
    channel.publish('game_start', {})
  }

  if (!player) return null

  const MIN_PLAYERS = 4
  const canStart = player.isHost && players.length >= MIN_PLAYERS

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm space-y-8 px-6 text-center">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Room Code</p>
          <p className="mt-1 font-mono text-5xl font-bold tracking-widest text-zinc-900 dark:text-zinc-50">
            {code}
          </p>
        </div>

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
          </div>
        </div>

        {player.isHost ? (
          <div className="space-y-2">
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {players.length < MIN_PLAYERS
                ? `Need ${MIN_PLAYERS - players.length} more players`
                : 'Start Game'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Waiting for host to start...
          </p>
        )}

        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  )
}
