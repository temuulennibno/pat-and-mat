# Pat and Mat — Game Design Spec

## Overview

Pat and Mat is a real-time multiplayer drawing game where pairs of players cooperatively draw using an "Axis Split" mechanic — one player controls the pen's X movement, the other controls Y. After drawing, all players vote on each other's drawings. 5 rounds with increasing difficulty determine the winner.

## Core Decisions

- **Players:** 6–12 per room, forming 3–6 teams of 2
- **Real-time:** Ably (pub/sub + presence)
- **Persistence:** Vercel KV (Redis) for room state (TTL-based, no permanent storage)
- **Architecture:** Client-heavy. Host client drives game logic; API routes are thin (room CRUD + Ably token auth)
- **Auth:** None. Players enter a display name to play.
- **Room access:** 4-character alphanumeric room codes

## 1. Room System

### Creating a Room

- Player enters a display name, clicks "Create Room"
- `POST /api/rooms` generates a 4-char alphanumeric code (e.g. `ABCD`)
- Room state stored in Vercel KV with a 2-hour TTL
- Creator becomes "host" and lands in the lobby

### Joining a Room

- Player enters display name + room code, clicks "Join"
- `POST /api/rooms/[code]/join` validates the code exists and room isn't full (max 12)
- Player joins Ably channel `room:<code>` and presence is broadcast

### Room State (KV)

```json
{
  "code": "ABCD",
  "hostId": "player_abc123",
  "players": [{ "id": "player_abc123", "name": "Alice", "joinedAt": 1712764800 }],
  "status": "waiting",
  "createdAt": 1712764800
}
```

Status values: `waiting` | `playing` | `finished`

### Lobby Screen

- Room code displayed prominently (easy to share)
- Live player list (updated via Ably presence)
- Host sees "Start Game" button (enabled when 6+ players joined)

## 2. Game Flow & Round Management

### Game State (Host Client)

```json
{
  "round": 1,
  "phase": "drawing",
  "teams": [{ "id": "team1", "player1": "p1", "player2": "p2" }],
  "prompt": "Draw a house",
  "scores": { "team1": 0, "team2": 0 },
  "drawings": { "team1": [] }
}
```

Phases: `drawing` | `viewing` | `voting` | `results`

### Round Flow (Host Drives Transitions)

1. **Round Start** — Host shuffles players, pairs into teams, picks prompt by difficulty, broadcasts `round_start` with teams + prompt
2. **Drawing Phase (20–30s)** — Timer on host. Paired players draw via Axis Split. Host broadcasts `drawing_end` when time's up.
3. **Viewing Phase** — Drawings shown one at a time with stroke replay animation. Host advances to voting.
4. **Voting Phase (10s per drawing)** — Each player votes thumbs up/down on every other team's drawing. Auto-submits on timeout.
5. **Results Phase** — Host collects votes, calculates scores, broadcasts `round_result` with updated scoreboard. Host clicks "Next Round".

After round 5: final scoreboard, MVP tag, personal stats. Host sees "Play Again" button.

### Difficulty Progression

| Round | Difficulty | Example Prompt |
|-------|-----------|----------------|
| 1 | Concrete object | "Draw a house" |
| 2 | Abstract concept | "Draw happiness" |
| 3 | Complex object | "Draw a bicycle" |
| 4 | Action/scenario | "Someone running late" |
| 5 | Conflicting/chaotic | "Something both hot and cold" |

Prompts stored as a static list in the codebase, randomly selected per difficulty tier.

### Player Re-pairing

Players are shuffled and re-paired every round. No pair repeats if avoidable. This prevents one strong duo dominating or one weak duo stuck together.

## 3. Axis Split Drawing Mechanic

### How It Works

- Each team of 2 shares one canvas (HTML5 Canvas, 400x400px)
- Player 1 assigned X-axis, Player 2 assigned Y-axis
- Pen position = `(Player1.cursorX, Player2.cursorY)`
- When either player moves, they publish their axis value to Ably

### Drawing Rules

- **Both players must press/hold to draw.** Pen is only active when both players are holding down.
- Releasing by either player lifts the pen.
- A dot indicator shows the current pen position in real-time so both players can coordinate.

### Ably Events (Team Channel)

Channel: `room:<code>:team:<teamId>`

| Event | Data | Sender |
|-------|------|--------|
| `move_x` | `{ x: number }` | Player 1 (X-axis) |
| `move_y` | `{ y: number }` | Player 2 (Y-axis) |
| `pen_down` | `{ playerId }` | Either player |
| `pen_up` | `{ playerId }` | Either player |

### Stroke Storage

- Strokes collected as arrays of `{ x, y, timestamp }` points
- Stored in memory on both clients during drawing phase
- At `drawing_end`, host collects final stroke data for replay

### Canvas Specs

- Fixed 400x400px
- Black pen on white background
- Single stroke width, no color/size options

## 4. Voting & Scoring

### Voting Flow

1. Each team's drawing shown one at a time with stroke replay
2. Two buttons below: thumbs up / thumbs down
3. Players cannot vote on their own team's drawing
4. 10-second timer per drawing; auto-submits on timeout (abstain — not counted)
5. Votes published to `room:<code>` as `vote` events
6. Host client collects all votes

### Score Calculation

Per team per round:

```
normalizedScore = goodVotes / totalVotes    (0 to 1)
roundScore = Math.round(normalizedScore * 10)
```

**Bonus:** If `goodVotes / totalVotes >= 0.70` then +2 bonus points.

**Round 5 multiplier:** All round 5 scores (including bonus) are doubled.

### Anti-Troll

If a player votes ALL thumbs down across every team in a round, their votes are discarded for that round.

### Scoreboard

- Shown after each round during results phase
- Teams ranked by cumulative total score
- Per-round breakdown visible

### Final Screen (After Round 5)

- Winner: highest total score
- MVP tag: player whose teams received the most total good votes across all rounds
- Personal stat: "You received X thumbs up votes"
- Host sees "Play Again" button (reshuffles, resets scores)

## 5. Pages & Navigation

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Home — enter display name, "Create Room" or "Join Room" (with code input) |
| `/room/[code]` | Lobby — player list, room code display, host Start button |
| `/room/[code]/play` | Game — all phases render here (drawing, viewing, voting, results) |

### Client-Side State

- Player info (id, name, isHost) in React context + localStorage (survives refresh)
- Game state from Ably subscriptions, kept in React state
- All game pages are client-rendered (no SSR needed)

### Ably Channels

| Channel | Purpose |
|---------|---------|
| `room:<code>` | Main game events + presence |
| `room:<code>:team:<teamId>` | Drawing axis events between paired players |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/rooms` | POST | Create room, store in KV, return code |
| `/api/rooms/[code]` | GET | Check room exists, return basic info |
| `/api/rooms/[code]/join` | POST | Add player to room in KV |
| `/api/ably/auth` | GET | Generate Ably token for client auth |

## 6. Tech Stack

### Existing

- Next.js 16
- React 19
- Tailwind CSS 4
- TypeScript

### Adding

| Package | Purpose |
|---------|---------|
| `ably` | Real-time pub/sub, presence, client SDK |
| `@vercel/kv` | Room state persistence (Redis-backed) |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `ABLY_API_KEY` | Server-side Ably token generation |
| `KV_REST_API_URL` | Vercel KV connection URL |
| `KV_REST_API_TOKEN` | Vercel KV auth token |

### Dev Requirements

- Ably free tier account (200 concurrent connections)
- Vercel KV instance or local Redis

## 7. Ably Event Reference

### Main Channel (`room:<code>`)

| Event | Direction | Data |
|-------|-----------|------|
| `round_start` | Host → All | `{ round, difficulty, prompt, teams }` |
| `drawing_end` | Host → All | `{ round }` |
| `vote_start` | Host → All | `{ teams }` |
| `vote` | Player → Host | `{ userId, teamId, vote: "good" \| "bad" }` |
| `round_result` | Host → All | `{ scores, mvp, round }` |
| `game_end` | Host → All | `{ finalScores, winner, mvp, stats }` |

### Team Channel (`room:<code>:team:<teamId>`)

| Event | Direction | Data |
|-------|-----------|------|
| `move_x` | P1 → P2 | `{ x: number }` |
| `move_y` | P2 → P1 | `{ y: number }` |
| `pen_down` | Either → Other | `{ playerId }` |
| `pen_up` | Either → Other | `{ playerId }` |
