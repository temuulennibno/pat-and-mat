'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayer } from './lib/player-context'

export default function Home() {
  const router = useRouter()
  const { setPlayer } = usePlayer()
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'home' | 'join'>('home')

  async function handleCreate() {
    if (!name.trim()) return setError('Enter your name')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPlayer({
        id: data.playerId,
        name: name.trim(),
        roomCode: data.code,
        isHost: true,
      })
      router.push(`/room/${data.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('Enter your name')
    if (!joinCode.trim()) return setError('Enter a room code')
    setLoading(true)
    setError('')

    try {
      const code = joinCode.trim().toUpperCase()
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPlayer({
        id: data.playerId,
        name: name.trim(),
        roomCode: code,
        isHost: false,
      })
      router.push(`/room/${code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pat & Mat
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Axis Split Drawing Game
          </p>
        </div>

        {mode === 'home' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-4 text-center text-lg text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-50"
            />

            <button
              onClick={() => setMode('join')}
              className="w-full rounded-xl bg-zinc-900 px-4 py-4 text-lg font-bold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Join Room
            </button>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full rounded-xl border-2 border-zinc-300 px-4 py-4 text-lg font-bold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Create Room
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-4 text-center text-lg text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-50"
            />

            <input
              type="text"
              placeholder="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-4 text-center font-mono text-2xl tracking-[0.3em] text-zinc-900 uppercase placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-50"
            />

            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full rounded-xl bg-zinc-900 px-4 py-4 text-lg font-bold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Join
            </button>

            <button
              onClick={() => { setMode('home'); setError('') }}
              className="w-full rounded-xl px-4 py-3 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Back
            </button>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  )
}
