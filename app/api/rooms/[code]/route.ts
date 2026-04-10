import { kv } from '@/app/lib/kv'
import type { Room } from '@/app/lib/types'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/rooms/[code]'>
) {
  const { code } = await ctx.params

  const room = await kv.get<Room>(`room:${code}`)
  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }

  return Response.json({ room })
}
