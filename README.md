# @gagandeep023/stone-age-backend

A complete backend engine for the **Stone Age** board game, built with TypeScript. Includes the full game engine, multiplayer room management via Socket.IO, SQLite persistence, and Express REST endpoints.

Designed as a standalone npm package that can be integrated into any Node.js server.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Game Rules Implementation](#game-rules-implementation)
- [Socket.IO Events](#socketio-events)
- [REST Endpoints](#rest-endpoints)
- [Persistence](#persistence)
- [Package Exports](#package-exports)
- [Configuration](#configuration)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [License](#license)

## Features

- **Full Game Engine** - 3-phase gameplay (worker placement, action resolution, feeding) with complete Stone Age rule enforcement
- **Multiplayer Rooms** - Create, join, and manage game rooms with passcode support and reconnection handling
- **Real-time Sync** - Socket.IO namespace with bidirectional events for all game actions
- **SQLite Persistence** - Game state saving, player stats, and leaderboard tracking
- **36 Civilization Cards** - 16 culture cards (8 symbols x 2) and 20 multiplier cards across 4 categories, each with immediate effects
- **28 Building Tiles** - Fixed, flexible, and variable cost types with shuffled stacks
- **Player Count Balancing** - Automatic village location blocking for 2-3 player games
- **Dice Mechanics** - Resource gathering with tool bonuses and one-use tool support
- **Comprehensive Scoring** - In-game VP, culture sets (n^2), multiplier categories, resource scoring, and tiebreakers
- **Full Test Coverage** - 68+ tests across 8 test suites

## Installation

```bash
npm install @gagandeep023/stone-age-backend
```

### Peer Dependencies

These must be installed separately in your project:

```bash
npm install express socket.io better-sqlite3
```

## Quick Start

### Basic Server Setup

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupStoneAgeBackend } from '@gagandeep023/stone-age-backend/backend';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Set up game routes and socket handlers
setupStoneAgeBackend(app, io, {
  dbPath: './stone-age.db'  // SQLite database path
});

httpServer.listen(3001, () => {
  console.log('Stone Age server running on port 3001');
});
```

### Using the Game Engine Directly

If you only need the game logic without networking:

```typescript
import { GameEngine } from '@gagandeep023/stone-age-backend';

// Create a new game
const players = [
  { id: 'player1', name: 'Alice' },
  { id: 'player2', name: 'Bob' },
];

const state = GameEngine.createGame('game-123', players);

// Process a game action
const result = GameEngine.processAction(state, {
  type: 'placeWorkers',
  playerId: 'player1',
  location: 'forest',
  count: 3,
});

if (result.error) {
  console.error(result.error);
} else {
  console.log('Updated state:', result.state);
}
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Socket.IO Layer                    │
│              (StoneAgeSocket.ts)                     │
│         Handles events, auth, reconnection           │
├───────────────┬─────────────────────────────────────┤
│  Room Manager │          REST Routes                 │
│  (rooms/)     │          (backend/)                  │
│  Create/Join  │     /rooms, /games/:id               │
│  Leave/Start  │     /stats, /leaderboard             │
├───────────────┴─────────────────────────────────────┤
│                  Game Engine                          │
│              (GameEngine.ts)                          │
│         Action dispatcher + validation                │
├──────────┬──────────────┬───────────────────────────┤
│  Worker  │   Action     │       Feeding              │
│ Placement│  Resolution  │     (Feeding.ts)           │
│          │              │                             │
│ Validate │ Dice rolls   │  Feed workers              │
│ Place    │ Tools        │  Resource substitution     │
│ Advance  │ Buildings    │  Starvation (-10 VP)       │
│ turn     │ Civ cards    │  End round                 │
├──────────┴──────────────┴───────────────────────────┤
│               Game Data                              │
│   Buildings (28) │ Civ Cards (36) │ Constants        │
├──────────────────────────────────────────────────────┤
│              SQLite Persistence                       │
│             (SqliteStore.ts)                          │
│    Games │ Game States │ Player Stats │ Leaderboard  │
└──────────────────────────────────────────────────────┘
```

## Game Rules Implementation

### Three-Phase Gameplay

**1. Worker Placement**
- Players take turns placing workers (starting with 5, max 10) on board locations
- Each location has capacity limits and specific rules (e.g., Hut requires exactly 2 workers)
- For 2-3 player games, one village location is blocked each round on a rotating basis
- Phase ends when all players have placed all available workers

**2. Action Resolution**
- Players resolve their placed workers in turn order
- Resource locations (Hunting Grounds, Forest, Clay Pit, Quarry, River) trigger dice rolls
  - Number of dice = number of workers placed
  - Resources earned = (dice total + tool bonuses) / resource divisor
  - Divisors: Food=2, Wood=3, Brick=4, Stone=5, Gold=6
- Village locations (Tool Maker, Hut, Field) grant immediate upgrades
- Building stacks and Civilization card slots require resource payments

**3. Feeding**
- Each worker costs 1 food to feed
- Food production bonus is added before feeding
- Resources can substitute for food at a 1:1 ratio
- Starvation penalty: -10 VP if unable to feed all workers

### Board Locations

| Location | Workers | Effect |
|----------|---------|--------|
| Hunting Grounds | 1-40 | Roll dice, gather food (divisor 2) |
| Forest | 1-7 | Roll dice, gather wood (divisor 3) |
| Clay Pit | 1-7 | Roll dice, gather brick (divisor 4) |
| Quarry | 1-7 | Roll dice, gather stone (divisor 5) |
| River | 1-7 | Roll dice, gather gold (divisor 6) |
| Tool Maker | 1 | Gain or upgrade a tool (max 3 tools, level 1-4) |
| Hut | 2 | Gain +1 worker (max 10) |
| Field | 1 | Gain +1 food production (max 10) |
| Building 0-3 | 1 | Pay resources for VP |
| Civ Card 0-3 | 1 | Pay 1-4 resources for card + immediate effect |

### Scoring

| Category | Calculation |
|----------|------------|
| In-game VP | Accumulated during play (buildings, cards, penalties) |
| Culture Sets | unique_symbols^2 per set |
| Farmer | card_count x food_production |
| Tool Maker | card_count x total_tool_level |
| Hut Builder | card_count x building_count |
| Shaman | card_count x total_workers |
| Resources | 1 VP per resource + 1 VP per food |

Tiebreakers: food production, then total tool level, then total workers.

### Game End Conditions

The game ends after the current round when either:
- The civilization card deck cannot fill all 4 display slots
- Any building stack is completely empty

## Socket.IO Events

### Client to Server

| Event | Payload | Description |
|-------|---------|-------------|
| `createRoom` | `{ name, maxPlayers, passcode? }` | Create a new game room |
| `joinRoom` | `{ roomId, passcode? }` | Join an existing room |
| `leaveRoom` | - | Leave current room |
| `startGame` | - | Start the game (host only, 2+ players) |
| `placeWorkers` | `{ location, count }` | Place workers at a location |
| `resolveAction` | `{ location }` | Resolve a placed location (triggers dice roll) |
| `useTools` | `{ toolIndices }` | Apply tools to current dice roll |
| `confirmResourceGathering` | - | Confirm and collect gathered resources |
| `payForBuilding` | `{ resources }` | Pay resources for a building tile |
| `payForCard` | `{ resources }` | Pay resources for a civilization card |
| `skipAction` | - | Skip an optional building/card action |
| `feedWorkers` | `{ resourcesAsFood? }` | Feed workers, optionally converting resources |
| `acceptStarvation` | - | Accept the -10 VP starvation penalty |
| `chooseDiceReward` | `{ choice }` | Choose reward from a dice-for-items card effect |

### Server to Client

| Event | Payload | Description |
|-------|---------|-------------|
| `roomList` | `rooms[]` | List of available public rooms |
| `roomUpdate` | `room` | Room state update (players joined/left) |
| `gameState` | `GameState` | Full game state (sent on every change) |
| `phaseChange` | `{ phase, roundNumber }` | Phase transition notification |
| `turnChange` | `{ playerId }` | Active player changed |
| `diceResult` | `{ playerId, dice[], location }` | Dice roll result |
| `gameOver` | `{ finalScores[] }` | Game over with final score breakdown |
| `playerDisconnected` | `{ playerId }` | Player lost connection |
| `playerReconnected` | `{ playerId }` | Player reconnected |
| `error` | `{ message }` | Error message |
| `notification` | `{ message }` | General notification |

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rooms` | List available rooms |
| `GET` | `/games/:id` | Get game state by ID (for reconnection) |
| `GET` | `/stats/:userId` | Get player stats (games played, wins, scores) |
| `GET` | `/leaderboard?limit=20` | Top players ranked by wins |

## Persistence

The SQLite database stores:

- **games** - Game metadata (room name, player count, status, timestamps)
- **game_states** - Serialized game state JSON (updated on every action)
- **game_players** - Per-player results (color, final score per game)
- **player_stats** - Aggregated stats (games played, wins, total/highest score)

Tables are created automatically on first connection.

## Package Exports

```typescript
// Main export - game engine + room manager
import { GameEngine, RoomManager } from '@gagandeep023/stone-age-backend';

// Backend export - Express routes + Socket.IO setup
import { setupStoneAgeBackend } from '@gagandeep023/stone-age-backend/backend';

// Types only
import type { GameState, PlayerState, LocationId } from '@gagandeep023/stone-age-backend/types';
```

### Subpath Exports

| Path | Contents |
|------|----------|
| `.` | GameEngine, RoomManager, all game modules |
| `./backend` | Express route setup, Socket.IO handler setup |
| `./types` | All TypeScript type definitions |

## Configuration

### Game Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `INITIAL_WORKERS` | 5 | Starting workers per player |
| `MAX_WORKERS` | 10 | Maximum workers per player |
| `INITIAL_FOOD` | 12 | Starting food per player |
| `MAX_FOOD_PRODUCTION` | 10 | Food production cap |
| `MAX_TOOL_LEVEL` | 4 | Maximum level per tool |
| `MAX_TOOL_SLOTS` | 3 | Maximum permanent tools |
| `STARVATION_PENALTY` | -10 | VP lost when unable to feed |
| `RECONNECT_GRACE_MS` | 120,000 | Reconnection window (2 minutes) |

### Resource Supply

| Resource | Initial Supply |
|----------|---------------|
| Wood | 28 |
| Brick | 18 |
| Stone | 12 |
| Gold | 10 |

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

### Test Suites

| Suite | Tests | Coverage |
|-------|-------|----------|
| GameEngine | 13 | Game creation, action dispatch, full round flow |
| WorkerPlacement | 13 | Validation rules, placement execution, turn advancement |
| ActionResolution | 23 | Dice rolls, tools, buildings, cards, village locations |
| Feeding | 9 | Food deduction, resource substitution, starvation |
| Scoring | 6 | Culture sets, multipliers, resources, tiebreakers |
| DiceRoller | 7 | Roll mechanics, resource calculation |
| GameSetup | 11 | Initial state, player setup, board configuration |
| PlayerCountRules | 10 | Village blocking, stack counts, availability |
| Buildings | 8 | Tile inventory, shuffling, stack creation |
| CivilizationCards | 12 | Card inventory, symbol distribution, deck shuffling |

## Project Structure

```
src/
├── index.ts                  # Main package exports
├── backend/
│   └── index.ts              # Express routes + Socket.IO setup
├── data/
│   ├── buildings.ts          # 28 building tile definitions
│   ├── buildings.test.ts
│   ├── civilizationCards.ts  # 36 civilization card definitions
│   ├── civilizationCards.test.ts
│   └── constants.ts          # Game constants and resource maps
├── engine/
│   ├── GameEngine.ts         # Main game engine (action dispatcher)
│   ├── GameEngine.test.ts
│   ├── GameSetup.ts          # Initial state creation
│   ├── GameSetup.test.ts
│   ├── WorkerPlacement.ts    # Placement phase logic
│   ├── WorkerPlacement.test.ts
│   ├── ActionResolution.ts   # Action phase logic (dice, buildings, cards)
│   ├── ActionResolution.test.ts
│   ├── Feeding.ts            # Feeding phase + round end
│   ├── Feeding.test.ts
│   ├── Scoring.ts            # Final scoring calculations
│   ├── Scoring.test.ts
│   ├── DiceRoller.ts         # Dice rolling + resource math
│   ├── DiceRoller.test.ts
│   ├── PlayerCountRules.ts   # 2/3/4 player balancing
│   └── PlayerCountRules.test.ts
├── persistence/
│   └── SqliteStore.ts        # SQLite database layer
├── rooms/
│   └── RoomManager.ts        # Multiplayer room management
├── socket/
│   └── StoneAgeSocket.ts     # Socket.IO event handlers
└── types/
    └── index.ts              # All TypeScript interfaces and types
```

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript (ES2022 target)
- **Networking**: Socket.IO 4.x
- **HTTP**: Express 4.x
- **Database**: better-sqlite3
- **Build**: tsup (ESM + CommonJS dual output)
- **Testing**: Vitest

## License

MIT
