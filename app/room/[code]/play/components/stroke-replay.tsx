'use client'

import { useRef, useEffect } from 'react'
import type { Drawing } from '@/app/lib/types'

type StrokeReplayProps = {
  drawing: Drawing
  size?: number
  animate?: boolean
}

const DEFAULT_SIZE = 300

export default function StrokeReplay({
  drawing,
  size = DEFAULT_SIZE,
  animate = true,
}: StrokeReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    if (!drawing || drawing.length === 0) return

    if (!animate) {
      drawAll(ctx, drawing, size)
      return
    }

    const allPoints: { x: number; y: number; strokeIndex: number }[] = []
    for (let s = 0; s < drawing.length; s++) {
      for (const point of drawing[s]) {
        allPoints.push({ x: point.x, y: point.y, strokeIndex: s })
      }
    }

    if (allPoints.length === 0) return

    let pointIndex = 0
    const scale = size / 400

    const interval = setInterval(() => {
      if (pointIndex >= allPoints.length) {
        clearInterval(interval)
        return
      }

      const batchSize = Math.max(1, Math.floor(allPoints.length / 60))
      const end = Math.min(pointIndex + batchSize, allPoints.length)

      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3 * scale
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (let i = pointIndex; i < end; i++) {
        const p = allPoints[i]
        const prev = i > 0 ? allPoints[i - 1] : null

        if (!prev || prev.strokeIndex !== p.strokeIndex) {
          ctx.beginPath()
          ctx.moveTo(p.x * scale, p.y * scale)
        } else {
          ctx.beginPath()
          ctx.moveTo(prev.x * scale, prev.y * scale)
          ctx.lineTo(p.x * scale, p.y * scale)
          ctx.stroke()
        }
      }

      pointIndex = end
    }, 16)

    return () => clearInterval(interval)
  }, [drawing, size, animate])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-lg border border-zinc-200 dark:border-zinc-800"
      style={{ width: '100%', maxWidth: size }}
    />
  )
}

function drawAll(ctx: CanvasRenderingContext2D, drawing: Drawing, size: number) {
  const scale = size / 400
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 3 * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const stroke of drawing) {
    if (stroke.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(stroke[0].x * scale, stroke[0].y * scale)
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x * scale, stroke[i].y * scale)
    }
    ctx.stroke()
  }
}
