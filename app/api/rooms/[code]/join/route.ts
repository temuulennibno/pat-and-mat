import Ably from 'ably'
import { kv } from '@/app/lib/kv'
import { generateId } from '@/app/lib/utils'
import type { Room, Player } from '@/app/lib/types'

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/rooms/[code]/join'>
) {
  const { code } = await ctx.params
  const body = await request.json()
  const { playerName } = body

  if (!playerName || typeof playerName !== 'string') {
    return Response.json({ error: 'playerName is required' }, { status: 400 })
  }

  const room = await kv.get<Room>(`room:${code}`)
  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.status !== 'waiting') {
    return Response.json({ error: 'Game already in progress' }, { status: 400 })
  }

  if (room.players.length >= 12) {
    return Response.json({ error: 'Room is full' }, { status: 400 })
  }

  const playerId = generateId()
  const newPlayer: Player = { id: playerId, name: playerName, joinedAt: Date.now() }
  room.players.push(newPlayer)
  await kv.set(`room:${code}`, room, { ex: 7200 })

  // Broadcast to lobby via Ably
  const apiKey = process.env.ABLY_API_KEY
  if (apiKey) {
    const ably = new Ably.Rest(apiKey)
    const channel = ably.channels.get(`room:${code}`)
    await channel.publish('player_joined', newPlayer)
  }

  return Response.json({ playerId, room })
}
