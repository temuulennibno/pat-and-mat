'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

type PlayerInfo = {
  id: string
  name: string
  roomCode: string
  isHost: boolean
}

type PlayerContextType = {
  player: PlayerInfo | null
  setPlayer: (info: PlayerInfo) => void
  clearPlayer: () => void
}

const PlayerContext = createContext<PlayerContextType | null>(null)

const STORAGE_KEY = 'pat-and-mat-player'

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayerState] = useState<PlayerInfo | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setPlayerState(JSON.parse(stored))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  const setPlayer = useCallback((info: PlayerInfo) => {
    setPlayerState(info)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
  }, [])

  const clearPlayer = useCallback(() => {
    setPlayerState(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <PlayerContext value={{ player, setPlayer, clearPlayer }}>
      {children}
    </PlayerContext>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
