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
  const [penPos, setPenPos] = useState({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 })
  const rafRef = useRef<number>(0)

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

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw completed strokes
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

    // Draw current stroke
    const current = currentStrokeRef.current
    if (current.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(current[0].x, current[0].y)
      for (let i = 1; i < current.length; i++) {
        ctx.lineTo(current[i].x, current[i].y)
      }
      ctx.stroke()
    }

    // Draw cursor dot
    const pos = getCurrentPos()
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = bothDown() ? '#000000' : '#aaaaaa'
    ctx.fill()

    rafRef.current = requestAnimationFrame(render)
  }, [getCurrentPos, bothDown])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [render])

  // Subscribe to partner events
  useEffect(() => {
    const moveEvent = axis === 'x' ? 'move_y' : 'move_x'

    teamChannel.subscribe(moveEvent, (msg) => {
      if (axis === 'x') {
        partnerPosRef.current.y = msg.data.value
      } else {
        partnerPosRef.current.x = msg.data.value
      }

      const pos = getCurrentPos()
      setPenPos(pos)

      if (bothDown()) {
        currentStrokeRef.current.push({ x: pos.x, y: pos.y, t: Date.now() })
      }
    })

    teamChannel.subscribe('pen_down', (msg) => {
      if (msg.data.playerId !== playerId) {
        partnerPenDownRef.current = true
      }
    })

    teamChannel.subscribe('pen_up', (msg) => {
      if (msg.data.playerId !== playerId) {
        partnerPenDownRef.current = false
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
      // Only player1 (x-axis) submits to avoid duplicates
      if (axis === 'x') {
        onDrawingComplete([...strokesRef.current])
      }
    }
  }, [timeLeft, axis, onDrawingComplete])

  function handlePointerMove(e: React.PointerEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height

    if (axis === 'x') {
      const x = Math.max(0, Math.min(CANVAS_SIZE, (e.clientX - rect.left) * scaleX))
      myPosRef.current.x = x
      teamChannel.publish('move_x', { value: x })
    } else {
      const y = Math.max(0, Math.min(CANVAS_SIZE, (e.clientY - rect.top) * scaleY))
      myPosRef.current.y = y
      teamChannel.publish('move_y', { value: y })
    }

    const pos = getCurrentPos()
    setPenPos(pos)

    if (bothDown()) {
      currentStrokeRef.current.push({ x: pos.x, y: pos.y, t: Date.now() })
    }
  }

  function handlePointerDown() {
    myPenDownRef.current = true
    teamChannel.publish('pen_down', { playerId })
  }

  function handlePointerUp() {
    myPenDownRef.current = false
    teamChannel.publish('pen_up', { playerId })
    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current])
      currentStrokeRef.current = []
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-[400px]">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          You control: <span className="font-bold text-zinc-900 dark:text-zinc-50">{axis.toUpperCase()}-axis</span>
        </span>
        <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {timeLeft}s
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="rounded-lg border-2 border-zinc-300 dark:border-zinc-700 touch-none cursor-crosshair"
        style={{ width: '100%', maxWidth: CANVAS_SIZE }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <p className="text-xs text-zinc-400">
        Both players must press and hold to draw
      </p>
    </div>
  )
}
