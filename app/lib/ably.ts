import Ably from 'ably'

let ablyClient: Ably.Realtime | null = null

export function getAblyClient(clientId: string): Ably.Realtime {
  if (ablyClient) return ablyClient

  ablyClient = new Ably.Realtime({
    authUrl: '/api/ably/auth',
    authParams: { clientId },
  })

  return ablyClient
}

export function closeAblyClient() {
  if (ablyClient) {
    ablyClient.close()
    ablyClient = null
  }
}
