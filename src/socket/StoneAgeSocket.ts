import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type {
  StoneAgeConfig, ClientToServerEvents, ServerToClientEvents,
  GameState,
} from '../types/index.js';
import { GameEngine, type GameAction } from '../engine/GameEngine.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { SqliteStore } from '../persistence/SqliteStore.js';

interface SocketData {
  userId: string;
  userName: string;
  userPicture?: string;
}

export function createStoneAgeSocket(
  httpServer: HttpServer,
  config: StoneAgeConfig,
): { io: Server; roomManager: RoomManager; destroy: () => void } {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/stone-age-ws',
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
    },
  });

  const roomManager = new RoomManager();
  const store = new SqliteStore(config.dbPath);

  // Namespace for stone age
  const nsp = io.of('/stone-age');

  nsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      if (!token || !config.validateSession) {
        console.warn('[StoneAge Socket] Auth rejected: no token or no validateSession');
        return next(new Error('Authentication required'));
      }

      const userId = await config.validateSession(token);
      if (!userId) {
        console.warn('[StoneAge Socket] Auth rejected: invalid session (token prefix:', token.substring(0, 20) + '...)');
        return next(new Error('Invalid session'));
      }

      const user = await config.getUserById(userId);
      if (!user) {
        console.warn('[StoneAge Socket] Auth rejected: user not found for id:', userId);
        return next(new Error('User not found'));
      }

      (socket.data as SocketData) = {
        userId: user.id,
        userName: user.name,
        userPicture: user.picture,
      };

      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  nsp.on('connection', (socket) => {
    const data = socket.data as SocketData;

    // Send current open rooms to newly connected socket
    socket.emit('roomList', roomManager.getOpenRooms());

    // Check for reconnection to existing game
    const existingRoom = roomManager.handleReconnect(data.userId, socket.id);
    if (existingRoom) {
      socket.join(existingRoom.id);
      if (existingRoom.gameState) {
        socket.emit('gameState', existingRoom.gameState);
      }
      nsp.to(existingRoom.id).emit('playerReconnected', { playerId: data.userId });
    }

    // --- Room Events ---

    socket.on('createRoom', ({ name, maxPlayers, passcode }) => {
      const room = roomManager.createRoom(
        data.userId, data.userName, name, maxPlayers, data.userPicture, passcode,
      );
      socket.join(room.id);
      // Send room to creator (include passcode so they can share it)
      socket.emit('roomUpdate', room);
      broadcastRoomList();
    });

    socket.on('joinRoom', ({ roomId, passcode }) => {
      // Check room exists first to give specific error
      const existing = roomManager.getRoom(roomId);
      if (!existing) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (existing.status !== 'waiting') {
        socket.emit('error', { message: 'Game already in progress' });
        return;
      }
      if (existing.players.length >= existing.maxPlayers) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      if (existing.isPrivate && existing.passcode !== passcode) {
        socket.emit('error', { message: 'Incorrect passcode' });
        return;
      }

      const room = roomManager.joinRoom(roomId, data.userId, data.userName, data.userPicture, passcode);
      if (!room) {
        socket.emit('error', { message: 'Cannot join room' });
        return;
      }
      socket.join(room.id);
      // Strip passcode from broadcast to other players
      const safeRoom = { ...room, passcode: undefined };
      nsp.to(room.id).emit('roomUpdate', safeRoom);
      broadcastRoomList();
    });

    socket.on('leaveRoom', () => {
      const result = roomManager.leaveRoom(data.userId);
      if (result) {
        socket.leave(result.room.id);
        if (!result.removed) {
          nsp.to(result.room.id).emit('roomUpdate', result.room);
        }
        broadcastRoomList();
      }
    });

    socket.on('endGame', () => {
      const result = roomManager.endGame(data.userId);
      if (result) {
        nsp.to(result.room.id).emit('gameEnded', { reason: 'Host ended the game' });
        broadcastRoomList();
      } else {
        socket.emit('error', { message: 'Only the host can end the game' });
      }
    });

    socket.on('startGame', () => {
      const room = roomManager.getRoomByPlayer(data.userId);
      if (!room) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      const result = roomManager.startGame(room.id, data.userId);
      if (!result) {
        socket.emit('error', { message: 'Cannot start game' });
        return;
      }

      // Persist initial state
      store.createGame(room.id, room.name, room.players.length, data.userId);
      store.saveGameState(room.id, result.gameState);

      nsp.to(room.id).emit('gameState', result.gameState);
      nsp.to(room.id).emit('phaseChange', {
        phase: result.gameState.phase,
        roundNumber: result.gameState.roundNumber,
      });
      broadcastRoomList();
    });

    // --- Game Action Events ---

    socket.on('placeWorkers', ({ location, count }) => {
      processGameAction(socket, {
        type: 'placeWorkers',
        playerId: data.userId,
        location,
        count,
      });
    });

    socket.on('resolveAction', ({ location }) => {
      processGameAction(socket, {
        type: 'resolveAction',
        playerId: data.userId,
        location,
      });
    });

    socket.on('useTools', ({ toolIndices }) => {
      processGameAction(socket, {
        type: 'useTools',
        playerId: data.userId,
        toolIndices,
      });
    });

    socket.on('confirmResourceGathering', () => {
      processGameAction(socket, {
        type: 'confirmResourceGathering',
        playerId: data.userId,
      });
    });

    socket.on('payForBuilding', ({ resources }) => {
      const room = roomManager.getRoomByPlayer(data.userId);
      if (!room?.gameState) return;

      // Find which building location the player is resolving
      const player = room.gameState.players.find(p => p.id === data.userId);
      if (!player) return;

      const buildingLoc = player.unresolvedLocations.find(l => l.startsWith('building_'));
      if (!buildingLoc) {
        socket.emit('error', { message: 'No building to resolve' });
        return;
      }

      processGameAction(socket, {
        type: 'payForBuilding',
        playerId: data.userId,
        location: buildingLoc,
        resources,
      });
    });

    socket.on('payForCard', ({ resources }) => {
      const room = roomManager.getRoomByPlayer(data.userId);
      if (!room?.gameState) return;

      const player = room.gameState.players.find(p => p.id === data.userId);
      if (!player) return;

      const cardLoc = player.unresolvedLocations.find(l => l.startsWith('civCard_'));
      if (!cardLoc) {
        socket.emit('error', { message: 'No card to resolve' });
        return;
      }

      processGameAction(socket, {
        type: 'payForCard',
        playerId: data.userId,
        location: cardLoc,
        resources,
      });
    });

    socket.on('skipAction', () => {
      const room = roomManager.getRoomByPlayer(data.userId);
      if (!room?.gameState) return;

      const player = room.gameState.players.find(p => p.id === data.userId);
      if (!player) return;

      // Skip first unresolved location
      const loc = player.unresolvedLocations[0];
      if (!loc) return;

      processGameAction(socket, {
        type: 'skipAction',
        playerId: data.userId,
        location: loc,
      });
    });

    socket.on('feedWorkers', ({ resourcesAsFood }) => {
      processGameAction(socket, {
        type: 'feedWorkers',
        playerId: data.userId,
        resourcesAsFood,
      });
    });

    socket.on('acceptStarvation', () => {
      processGameAction(socket, {
        type: 'acceptStarvation',
        playerId: data.userId,
      });
    });

    socket.on('chooseDiceReward', ({ choice }) => {
      processGameAction(socket, {
        type: 'chooseDiceReward',
        playerId: data.userId,
        choice,
      });
    });

    socket.on('chooseFlexResources', ({ resources }) => {
      processGameAction(socket, {
        type: 'chooseFlexResources',
        playerId: data.userId,
        resources,
      });
    });

    socket.on('chooseResourceDiceType', ({ resource }) => {
      processGameAction(socket, {
        type: 'chooseResourceDiceType',
        playerId: data.userId,
        resource,
      });
    });

    socket.on('sendChat', ({ message, emote }) => {
      const room = roomManager.getRoomByPlayer(data.userId);
      if (!room) return;
      nsp.to(room.id).emit('chat', {
        playerId: data.userId,
        playerName: data.userName,
        message: message.slice(0, 100),
        emote,
      });
    });

    // --- Disconnect ---

    socket.on('disconnect', () => {
      const room = roomManager.handleDisconnect(data.userId);
      if (room) {
        nsp.to(room.id).emit('playerDisconnected', { playerId: data.userId });
      }
    });

    // Helper: process action and broadcast result
    function processGameAction(sock: typeof socket, action: GameAction) {
      const room = roomManager.getRoomByPlayer(data.userId);
      if (!room?.gameState) {
        sock.emit('error', { message: 'No active game' });
        return;
      }

      const previousPhase = room.gameState.phase;
      const result = GameEngine.processAction(room.gameState, action);

      if (result.error) {
        sock.emit('error', { message: result.error });
        return;
      }

      // Update stored state
      roomManager.updateGameState(room.id, result.state);
      store.saveGameState(room.id, result.state);

      // Broadcast new state to all players in room
      nsp.to(room.id).emit('gameState', result.state);

      // Emit phase change if applicable
      if (result.state.phase !== previousPhase) {
        nsp.to(room.id).emit('phaseChange', {
          phase: result.state.phase,
          roundNumber: result.state.roundNumber,
        });
      }

      // Emit turn change
      const currentPlayer = result.state.players[result.state.currentPlayerIndex];
      nsp.to(room.id).emit('turnChange', { playerId: currentPlayer.id });

      // Handle game over
      if (result.state.gameOver && result.state.finalScores) {
        nsp.to(room.id).emit('gameOver', { finalScores: result.state.finalScores });

        // Persist final results
        store.finishGame(
          room.id,
          result.state.winner!,
          result.state.players.map((p, i) => ({
            userId: p.id,
            index: i,
            color: p.color,
            score: result.state.finalScores!.find(s => s.playerId === p.id)!.totalScore,
          })),
        );

        roomManager.finishGame(room.id);
      }
    }

    // Broadcast room list to all connected sockets
    function broadcastRoomList() {
      nsp.emit('roomList', roomManager.getOpenRooms());
    }
  });

  return {
    io,
    roomManager,
    destroy: () => {
      roomManager.destroy();
      store.close();
    },
  };
}
