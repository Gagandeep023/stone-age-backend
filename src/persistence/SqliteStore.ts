import type Database from 'better-sqlite3';
import type { GameState, PlayerStats } from '../types/index.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  room_name TEXT,
  player_count INTEGER,
  status TEXT DEFAULT 'waiting',
  created_by TEXT,
  created_at TEXT,
  finished_at TEXT,
  winner_id TEXT
);

CREATE TABLE IF NOT EXISTS game_states (
  game_id TEXT PRIMARY KEY REFERENCES games(id),
  state_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS game_players (
  game_id TEXT REFERENCES games(id),
  user_id TEXT,
  player_index INTEGER,
  color TEXT,
  final_score INTEGER,
  PRIMARY KEY (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS player_stats (
  user_id TEXT PRIMARY KEY,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  updated_at TEXT
);
`;

export class SqliteStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Dynamic import for better-sqlite3 (peer dep)
    const BetterSqlite3 = require('better-sqlite3');
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.init();
  }

  private init(): void {
    this.db.exec(SCHEMA);
  }

  // --- Game CRUD ---

  createGame(
    gameId: string,
    roomName: string,
    playerCount: number,
    createdBy: string,
  ): void {
    this.db.prepare(
      `INSERT INTO games (id, room_name, player_count, status, created_by, created_at)
       VALUES (?, ?, ?, 'playing', ?, ?)`
    ).run(gameId, roomName, playerCount, createdBy, new Date().toISOString());
  }

  saveGameState(gameId: string, state: GameState): void {
    const json = JSON.stringify(state);
    const now = new Date().toISOString();

    this.db.prepare(
      `INSERT OR REPLACE INTO game_states (game_id, state_json, updated_at) VALUES (?, ?, ?)`
    ).run(gameId, json, now);
  }

  loadGameState(gameId: string): GameState | null {
    const row = this.db.prepare(
      `SELECT state_json FROM game_states WHERE game_id = ?`
    ).get(gameId) as { state_json: string } | undefined;

    if (!row) return null;
    return JSON.parse(row.state_json);
  }

  finishGame(
    gameId: string,
    winnerId: string,
    players: Array<{ userId: string; index: number; color: string; score: number }>,
  ): void {
    const now = new Date().toISOString();

    const tx = this.db.transaction(() => {
      // Update game record
      this.db.prepare(
        `UPDATE games SET status = 'finished', finished_at = ?, winner_id = ? WHERE id = ?`
      ).run(now, winnerId, gameId);

      // Record player results
      const insertPlayer = this.db.prepare(
        `INSERT OR REPLACE INTO game_players (game_id, user_id, player_index, color, final_score)
         VALUES (?, ?, ?, ?, ?)`
      );

      for (const p of players) {
        insertPlayer.run(gameId, p.userId, p.index, p.color, p.score);
      }

      // Update player stats
      const upsertStats = this.db.prepare(
        `INSERT INTO player_stats (user_id, games_played, games_won, total_score, highest_score, updated_at)
         VALUES (?, 1, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           games_played = games_played + 1,
           games_won = games_won + ?,
           total_score = total_score + ?,
           highest_score = MAX(highest_score, ?),
           updated_at = ?`
      );

      for (const p of players) {
        const won = p.userId === winnerId ? 1 : 0;
        upsertStats.run(
          p.userId, won, p.score, p.score, now,
          won, p.score, p.score, now,
        );
      }
    });

    tx();
  }

  // --- Stats ---

  getPlayerStats(userId: string): PlayerStats | null {
    const row = this.db.prepare(
      `SELECT user_id, games_played, games_won, total_score, highest_score, updated_at
       FROM player_stats WHERE user_id = ?`
    ).get(userId) as any;

    if (!row) return null;

    return {
      userId: row.user_id,
      gamesPlayed: row.games_played,
      gamesWon: row.games_won,
      totalScore: row.total_score,
      highestScore: row.highest_score,
      updatedAt: row.updated_at,
    };
  }

  getLeaderboard(limit: number = 20): PlayerStats[] {
    const rows = this.db.prepare(
      `SELECT user_id, games_played, games_won, total_score, highest_score, updated_at
       FROM player_stats
       ORDER BY games_won DESC, highest_score DESC
       LIMIT ?`
    ).all(limit) as any[];

    return rows.map(row => ({
      userId: row.user_id,
      gamesPlayed: row.games_played,
      gamesWon: row.games_won,
      totalScore: row.total_score,
      highestScore: row.highest_score,
      updatedAt: row.updated_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}
