import type { GameRoom, RoomPlayer, GameState } from '../types/index.js';
import { GameEngine } from '../engine/GameEngine.js';
import { MIN_PLAYERS, MAX_PLAYERS, RECONNECT_GRACE_MS } from '../data/constants.js';
import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomId
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  createRoom(hostId: string, hostName: string, name: string, maxPlayers: number, hostPicture?: string, passcode?: string): GameRoom {
    const roomId = uuidv4().substring(0, 8);
    const clamped = Math.min(Math.max(maxPlayers, MIN_PLAYERS), MAX_PLAYERS);

    const room: GameRoom = {
      id: roomId,
      name,
      hostId,
      players: [{
        id: hostId,
        name: hostName,
        picture: hostPicture,
        connected: true,
      }],
      status: 'waiting',
      maxPlayers: clamped,
      createdAt: new Date().toISOString(),
      gameState: null,
      isPrivate: !!passcode,
      passcode: passcode || undefined,
    };

    this.rooms.set(roomId, room);
    this.playerRooms.set(hostId, roomId);
    return room;
  }

  joinRoom(roomId: string, playerId: string, playerName: string, playerPicture?: string, passcode?: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'waiting') return null;
    if (room.players.length >= room.maxPlayers) return null;

    // Check if player is already in this room (reconnecting)
    const existing = room.players.find(p => p.id === playerId);
    if (existing) {
      existing.connected = true;
      return room;
    }

    // Validate passcode for private rooms
    if (room.isPrivate && room.passcode !== passcode) {
      return null;
    }

    // Check if player is in another room
    const currentRoom = this.playerRooms.get(playerId);
    if (currentRoom && currentRoom !== roomId) {
      this.leaveRoom(playerId);
    }

    room.players.push({
      id: playerId,
      name: playerName,
      picture: playerPicture,
      connected: true,
    });

    this.playerRooms.set(playerId, roomId);
    return room;
  }

  leaveRoom(playerId: string): { room: GameRoom; removed: boolean } | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Always clear player mapping so auto-rejoin doesn't trigger
    this.playerRooms.delete(playerId);

    // Clear any disconnect timer
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    if (room.status === 'waiting') {
      room.players = room.players.filter(p => p.id !== playerId);

      // If room is empty, remove it
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        return { room, removed: true };
      }

      // If host left, assign new host
      if (room.hostId === playerId) {
        room.hostId = room.players[0].id;
      }
    } else if (room.status === 'playing') {
      // Mark as disconnected/abandoned (player forfeits turns)
      const player = room.players.find(p => p.id === playerId);
      if (player) player.connected = false;

      // If no connected players remain, end the game
      const connected = room.players.filter(p => p.connected);
      if (connected.length === 0) {
        room.status = 'finished';
        this.rooms.delete(roomId);
        return { room, removed: true };
      }
    }

    return { room, removed: false };
  }

  endGame(hostId: string): { room: GameRoom } | null {
    const roomId = this.playerRooms.get(hostId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Only host can end the game
    if (room.hostId !== hostId) return null;
    if (room.status !== 'playing') return null;

    room.status = 'finished';

    // Clear all player mappings and timers
    for (const player of room.players) {
      this.playerRooms.delete(player.id);
      const timer = this.disconnectTimers.get(player.id);
      if (timer) {
        clearTimeout(timer);
        this.disconnectTimers.delete(player.id);
      }
    }

    this.rooms.delete(roomId);
    return { room };
  }

  startGame(roomId: string, hostId: string): { room: GameRoom; gameState: GameState } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.hostId !== hostId) return null;
    if (room.status !== 'waiting') return null;
    if (room.players.length < MIN_PLAYERS) return null;

    room.status = 'playing';
    const gameState = GameEngine.createGame(roomId, room.players);
    room.gameState = gameState;

    return { room, gameState };
  }

  getRoom(roomId: string): GameRoom | null {
    return this.rooms.get(roomId) || null;
  }

  getRoomByPlayer(playerId: string): GameRoom | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  getOpenRooms(): GameRoom[] {
    return Array.from(this.rooms.values())
      .filter(r => r.status === 'waiting' && !r.isPrivate)
      .map(r => ({
        ...r,
        gameState: null,
        passcode: undefined,
      }));
  }

  handleDisconnect(playerId: string): GameRoom | null {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;

    player.connected = false;

    // Set reconnect grace period
    const timer = setTimeout(() => {
      this.handleAbandon(playerId);
    }, RECONNECT_GRACE_MS);

    this.disconnectTimers.set(playerId, timer);
    return room;
  }

  handleReconnect(playerId: string, socketId: string): GameRoom | null {
    // Clear disconnect timer
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.connected = true;
      player.socketId = socketId;
    }

    return room;
  }

  private handleAbandon(playerId: string): void {
    this.disconnectTimers.delete(playerId);
    const result = this.leaveRoom(playerId);
    // In a game, the player stays but is marked disconnected permanently
  }

  updateGameState(roomId: string, state: GameState): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.gameState = state;
      if (state.gameOver) {
        room.status = 'finished';
      }
    }
  }

  finishGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.status = 'finished';
      // Clean up player mappings after a delay
      setTimeout(() => {
        for (const player of room.players) {
          this.playerRooms.delete(player.id);
        }
        this.rooms.delete(roomId);
      }, 300_000); // 5 min cleanup
    }
  }

  destroy(): void {
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }
}
