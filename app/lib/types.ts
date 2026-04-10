export type Player = {
  id: string
  name: string
  joinedAt: number
}

export type RoomStatus = 'waiting' | 'playing' | 'finished'

export type Room = {
  code: string
  hostId: string
  hostName: string
  players: Player[]
  status: RoomStatus
  createdAt: number
}

export type Team = {
  id: string
  player1Id: string
  player2Id: string
}

export type Point = {
  x: number
  y: number
  t: number
}

export type Stroke = Point[]

export type Drawing = Stroke[]

export type Vote = {
  voterId: string
  teamId: string
  vote: 'good' | 'bad'
}

export type GamePhase = 'drawing' | 'viewing' | 'voting' | 'results'

export type GameState = {
  round: number
  phase: GamePhase
  teams: Team[]
  prompt: string
  cumulativeScores: Record<string, number>
  roundScores: Record<string, number>
  drawings: Record<string, Drawing>
  votes: Vote[]
}

export type Difficulty = 'concrete' | 'abstract' | 'complex' | 'action' | 'chaotic'

export type RoundStartEvent = {
  round: number
  difficulty: Difficulty
  prompt: string
  teams: Team[]
}

export type VoteEvent = {
  voterId: string
  teamId: string
  vote: 'good' | 'bad'
}

export type RoundResultEvent = {
  round: number
  roundScores: Record<string, number>
  cumulativeScores: Record<string, number>
  bonusTeams: string[]
}

export type DrawingSubmitEvent = {
  teamId: string
  drawing: Drawing
}

export type GameEndEvent = {
  finalScores: Record<string, number>
  winnerTeamId: string
  mvpPlayerId: string
  playerGoodVotes: Record<string, number>
}
