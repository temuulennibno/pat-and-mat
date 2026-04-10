'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { getAblyClient } from '@/app/lib/ably'
import type { Stroke, Drawing, Point } from '@/app/lib/types'

type DrawingCanvasProps = {
  roomCode: string
  teamId: string
  playerId: string
  axis: 'x' | 'y'
  timeLeft: number
  onDrawingComplete: (drawing: Drawing) => void
}

const CANVAS_SIZE = 400
const MOVE_SPEED = 4

export default function DrawingCanvas({
  roomCode,
  teamId,
  playerId,
  axis,
  timeLeft,
  onDrawingComplete,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const currentStrokeRef = useRef<Point[]>([])
  const myPosRef = useRef({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 })
  const partnerPosRef = useRef({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 })
  const myPenDownRef = useRef(false)
  const partnerPenDownRef = useRef(false)
  const directionRef = useRef<-1 | 0 | 1>(0)
  const rafRef = useRef<number>(0)
  const [isDrawing, setIsDrawing] = useState(false)
  const [partnerDrawing, setPartnerDrawing] = useState(false)

  const ably = getAblyClient(playerId)
  const teamChannel = ably.channels.get(`room:${roomCode}:team:${teamId}`)

  const bothDown = useCallback(() => {
    return myPenDownRef.current && partnerPenDownRef.current
  }, [])

  const getCurrentPos = useCallback(() => {
    if (axis === 'x') {
      return { x: myPosRef.current.x, y: partnerPosRef.current.y }
    }
    return { x: partnerPosRef.current.x, y: myPosRef.current.y }
  }, [axis])

  // Main game loop: move + render
  const gameLoop = useCallback(() => {
    // Move in current direction
    if (directionRef.current !== 0) {
      if (axis === 'x') {
        myPosRef.current.x = Math.max(0, Math.min(CANVAS_SIZE, myPosRef.current.x + directionRef.current * MOVE_SPEED))
        teamChannel.publish('move_x', { value: myPosRef.current.x })
      } else {
        myPosRef.current.y = Math.max(0, Math.min(CANVAS_SIZE, myPosRef.current.y + directionRef.current * MOVE_SPEED))
        teamChannel.publish('move_y', { value: myPosRef.current.y })
      }

      if (bothDown()) {
        const pos = getCurrentPos()
        currentStrokeRef.current.push({ x: pos.x, y: pos.y, t: Date.now() })
      }
    }

    // Render
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        for (const stroke of strokesRef.current) {
          if (stroke.length < 2) continue
          ctx.beginPath()
          ctx.moveTo(stroke[0].x, stroke[0].y)
          for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x, stroke[i].y)
          }
          ctx.stroke()
        }

        const current = currentStrokeRef.current
        if (current.length >= 2) {
          ctx.beginPath()
          ctx.moveTo(current[0].x, current[0].y)
          for (let i = 1; i < current.length; i++) {
            ctx.lineTo(current[i].x, current[i].y)
          }
          ctx.stroke()
        }

        // Cursor dot
        const pos = getCurrentPos()
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = bothDown() ? '#000000' : '#aaaaaa'
        ctx.fill()
        if (!bothDown()) {
          ctx.strokeStyle = '#888888'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    }

    rafRef.current = requestAnimationFrame(gameLoop)
  }, [axis, teamChannel, getCurrentPos, bothDown])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gameLoop])

  // Subscribe to partner events
  useEffect(() => {
    const moveEvent = axis === 'x' ? 'move_y' : 'move_x'

    teamChannel.subscribe(moveEvent, (msg) => {
      if (axis === 'x') {
        partnerPosRef.current.y = msg.data.value
      } else {
        partnerPosRef.current.x = msg.data.value
      }

      if (bothDown()) {
        const pos = getCurrentPos()
        currentStrokeRef.current.push({ x: pos.x, y: pos.y, t: Date.now() })
      }
    })

    teamChannel.subscribe('pen_down', (msg) => {
      if (msg.data.playerId !== playerId) {
        partnerPenDownRef.current = true
        setPartnerDrawing(true)
      }
    })

    teamChannel.subscribe('pen_up', (msg) => {
      if (msg.data.playerId !== playerId) {
        partnerPenDownRef.current = false
        setPartnerDrawing(false)
        if (currentStrokeRef.current.length > 0) {
          strokesRef.current.push([...currentStrokeRef.current])
          currentStrokeRef.current = []
        }
      }
    })

    return () => {
      teamChannel.unsubscribe()
    }
  }, [teamChannel, axis, playerId, getCurrentPos, bothDown])

  // Submit drawing when time runs out
  useEffect(() => {
    if (timeLeft === 0) {
      if (currentStrokeRef.current.length > 0) {
        strokesRef.current.push([...currentStrokeRef.current])
        currentStrokeRef.current = []
      }
      if (axis === 'x') {
        onDrawingComplete([...strokesRef.current])
      }
    }
  }, [timeLeft, axis, onDrawingComplete])

  // Direction button handlers
  function startMove(dir: -1 | 1) {
    directionRef.current = dir
  }

  function stopMove() {
    directionRef.current = 0
  }

  // Draw button handlers
  function startDraw() {
    myPenDownRef.current = true
    setIsDrawing(true)
    teamChannel.publish('pen_down', { playerId })
  }

  function stopDraw() {
    myPenDownRef.current = false
    setIsDrawing(false)
    teamChannel.publish('pen_up', { playerId })
    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current])
      currentStrokeRef.current = []
    }
  }

  const bothActive = isDrawing && partnerDrawing

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Timer */}
      <div className="flex items-center justify-between w-full">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          You control: <span className="font-bold text-zinc-900 dark:text-zinc-50">{axis === 'x' ? '← →' : '↑ ↓'}</span>
        </span>
        <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {timeLeft}s
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="rounded-lg border-2 border-zinc-300 dark:border-zinc-700"
        style={{ width: '100%', maxWidth: CANVAS_SIZE }}
      />

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={isDrawing ? 'text-green-500' : 'text-zinc-400'}>You: {isDrawing ? 'PEN DOWN' : 'pen up'}</span>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <span className={partnerDrawing ? 'text-green-500' : 'text-zinc-400'}>Partner: {partnerDrawing ? 'PEN DOWN' : 'pen up'}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 w-full">
        {/* Direction buttons */}
        <div className="flex gap-2 flex-1">
          {axis === 'x' ? (
            <>
              <button
                onPointerDown={() => startMove(-1)}
                onPointerUp={stopMove}
                onPointerLeave={stopMove}
                className="flex-1 select-none touch-none rounded-xl bg-zinc-200 py-5 text-2xl font-bold text-zinc-700 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:active:bg-zinc-700"
              >
                ←
              </button>
              <button
                onPointerDown={() => startMove(1)}
                onPointerUp={stopMove}
                onPointerLeave={stopMove}
                className="flex-1 select-none touch-none rounded-xl bg-zinc-200 py-5 text-2xl font-bold text-zinc-700 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:active:bg-zinc-700"
              >
                →
              </button>
            </>
          ) : (
            <>
              <button
                onPointerDown={() => startMove(-1)}
                onPointerUp={stopMove}
                onPointerLeave={stopMove}
                className="flex-1 select-none touch-none rounded-xl bg-zinc-200 py-5 text-2xl font-bold text-zinc-700 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:active:bg-zinc-700"
              >
                ↑
              </button>
              <button
                onPointerDown={() => startMove(1)}
                onPointerUp={stopMove}
                onPointerLeave={stopMove}
                className="flex-1 select-none touch-none rounded-xl bg-zinc-200 py-5 text-2xl font-bold text-zinc-700 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:active:bg-zinc-700"
              >
                ↓
              </button>
            </>
          )}
        </div>

        {/* Draw button */}
        <button
          onPointerDown={startDraw}
          onPointerUp={stopDraw}
          onPointerLeave={stopDraw}
          className={`flex-1 select-none touch-none rounded-xl py-5 text-lg font-bold transition-colors ${
            bothActive
              ? 'bg-green-500 text-white'
              : isDrawing
                ? 'bg-yellow-500 text-white'
                : 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
          }`}
        >
          {bothActive ? '● Drawing' : isDrawing ? '◐ Hold...' : 'Draw'}
        </button>
      </div>

      <p className="text-xs text-zinc-400 text-center">
        Both players must hold Draw at the same time
      </p>
    </div>
  )
}
