import Ably from 'ably'

export async function GET(request: Request) {
  try {
    const apiKey = process.env.ABLY_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'Ably not configured' }, { status: 500 })
    }

    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId') || 'anonymous'

    const client = new Ably.Rest(apiKey)
    const tokenRequest = await client.auth.createTokenRequest({ clientId })

    return Response.json(tokenRequest)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Ably auth error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
