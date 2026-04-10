import { kv } from '@/app/lib/kv'
import { generateRoomCode, generateId } from '@/app/lib/utils'
import type { Room } from '@/app/lib/types'

export async function POST(request: Request) {
  const body = await request.json()
  const { playerName } = body

  if (!playerName || typeof playerName !== 'string') {
    return Response.json({ error: 'playerName is required' }, { status: 400 })
  }

  let code = generateRoomCode()
  let existing = await kv.get<Room>(`room:${code}`)
  let attempts = 0
  while (existing && attempts < 10) {
    code = generateRoomCode()
    existing = await kv.get<Room>(`room:${code}`)
    attempts++
  }

  const playerId = generateId()
  const room: Room = {
    code,
    hostId: playerId,
    hostName: playerName,
    players: [],
    status: 'waiting',
    createdAt: Date.now(),
  }

  await kv.set(`room:${code}`, room, { ex: 7200 })

  return Response.json({ code, playerId, room })
}
