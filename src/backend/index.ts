import { Router, type Request, type Response } from 'express';
import type { Server as HttpServer } from 'http';
import type { StoneAgeConfig } from '../types/index.js';
import { createStoneAgeSocket } from '../socket/StoneAgeSocket.js';
import { SqliteStore } from '../persistence/SqliteStore.js';

export function createStoneAgeRoutes(config: StoneAgeConfig): Router {
  const router = Router();
  const store = new SqliteStore(config.dbPath);

  // Get room list (from socket's room manager - this is a fallback REST endpoint)
  // Primary room management happens via Socket.IO
  router.get('/rooms', (_req: Request, res: Response) => {
    // Room list is managed by the socket layer
    // This endpoint returns an empty list as rooms are ephemeral
    res.json({ rooms: [] });
  });

  // Get game state (for reconnection)
  router.get('/games/:id', (req: Request, res: Response) => {
    const state = store.loadGameState(req.params.id);
    if (!state) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.json(state);
  });

  // Get player stats
  router.get('/stats/:userId', (req: Request, res: Response) => {
    const stats = store.getPlayerStats(req.params.userId);
    res.json(stats || {
      userId: req.params.userId,
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      highestScore: 0,
    });
  });

  // Leaderboard
  router.get('/leaderboard', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const leaderboard = store.getLeaderboard(limit);

    // Enrich with user names
    const enriched = Promise.all(
      leaderboard.map(async (entry) => {
        const user = await config.getUserById(entry.userId);
        return {
          ...entry,
          name: user?.name || 'Unknown',
          picture: user?.picture,
        };
      })
    );

    enriched.then(data => res.json(data)).catch(() => res.json(leaderboard));
  });

  return router;
}

export { createStoneAgeSocket };

// Re-export types for convenience
export type { StoneAgeConfig } from '../types/index.js';
