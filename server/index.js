import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createRoom,
  generateRoomCode,
  getPlayerRole,
  getPrivateChallengeData,
  startGame,
  advancePhase,
  selectChip,
  returnChipToCenter,
  confirmChipSelection,
  requestTrade,
  respondToTrade,
  sanitizeRoomForClient,
  getPlayerCards,
  processShowdownStep,
  getShowdownStep,
  startNextHeist,
  returnToLobby,
  submitGuess,
  setGameMode,
  submitImposterAdvice,
  useCrewReroute,
  requestCrewVerification,
  respondCrewVerification,
  PHASES,
} from './src/gameEngine.js';
import { CHALLENGE_DEFS } from './src/challenges.js';
import {
  GAME_MODES,
  IMPOSTER_CHALLENGE_DEFS,
} from './src/imposterMode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;
const rooms = {};

function getRoomBySocket(socketId) {
  for (const [code, room] of Object.entries(rooms)) {
    if (room.players.some((p) => p.id === socketId)) {
      return { code, room };
    }
  }
  return null;
}

function broadcastRoom(code) {
  const room = rooms[code];
  if (!room) return;
  for (const player of room.players) {
    io.to(player.id).emit('ROOM_STATE', sanitizeRoomForClient(room, player.id));
  }
}

function sendPrivateCards(code, playerId) {
  const room = rooms[code];
  if (!room) return;
  const cards = getPlayerCards(room, playerId);
  io.to(playerId).emit('YOUR_CARDS', { cards });
}

function sendPrivateModeState(code) {
  const room = rooms[code];
  if (!room || room.gameState === PHASES.LOBBY) return;

  for (const player of room.players) {
    io.to(player.id).emit('YOUR_ROLE', {
      gameMode: room.gameMode,
      role: getPlayerRole(room, player.id),
    });
    io.to(player.id).emit('PRIVATE_CHALLENGE_STATE', getPrivateChallengeData(room, player.id));
  }
}

function sendShowdownStep(code, room) {
  for (const player of room.players) {
    io.to(player.id).emit('SHOWDOWN_STEP', getShowdownStep(room, player.id));
  }
}

const EMOTES = {
  higher: 'Tôi nên cao hơn bạn',
  lower: 'Bạn đang quá cao',
  agree: 'Tôi đồng ý vị trí này',
  swap: 'Đổi chỗ nhé',
  question: '?',
  up: '⬆️',
  down: '⬇️',
  safe: '✅',
  danger: '⚠️',
};

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('CREATE_ROOM', ({ playerName, maxPlayers = 6 }) => {
    const room = createRoom(socket.id, playerName, Math.min(6, Math.max(3, maxPlayers)));
    const code = generateRoomCode(rooms);
    room.code = code;
    rooms[code] = room;
    socket.join(code);
    socket.emit('ROOM_CREATED', { roomCode: code });
    broadcastRoom(code);
  });

  socket.on('JOIN_ROOM', ({ playerName, roomCode }) => {
    const code = roomCode?.toUpperCase();
    const room = rooms[code];
    if (!room) {
      socket.emit('ERROR', { message: 'Phòng không tồn tại' });
      return;
    }
    if (room.gameState !== PHASES.LOBBY) {
      socket.emit('ERROR', { message: 'Game đã bắt đầu' });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      socket.emit('ERROR', { message: 'Phòng đã đầy' });
      return;
    }
    room.players.push({
      id: socket.id,
      name: playerName,
      cards: [],
      publicShowdownCards: [],
      chips: {},
      connected: true,
    });
    socket.join(code);
    socket.emit('ROOM_JOINED', { roomCode: code });
    broadcastRoom(code);
  });

  socket.on('START_GAME', () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (room.hostId !== socket.id) {
      socket.emit('ERROR', { message: 'Chỉ host mới được bắt đầu' });
      return;
    }
    const result = startGame(room);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);
    for (const p of room.players) sendPrivateCards(code, p.id);
    sendPrivateModeState(code);
  });

  socket.on('SELECT_CHIP', ({ chipValue, targetPlayerId }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if ([PHASES.LOBBY, PHASES.SHOWDOWN, PHASES.GAME_OVER, PHASES.HEIST_RESULT].includes(room.gameState)) {
      return;
    }
    const result = selectChip(room, socket.id, chipValue, targetPlayerId || null);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);
  });

  socket.on('RETURN_CHIP', () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const result = returnChipToCenter(room, socket.id);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);
  });

  socket.on('CONFIRM_CHIP_SELECTION', ({ chipValue } = {}) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const result = confirmChipSelection(room, socket.id, chipValue);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);

    if (result.allConfirmed) {
      const adv = advancePhase(room);
      if (adv.showdown) {
        broadcastRoom(code);
        sendShowdownStep(code, room);
      } else if (adv.ok) {
        broadcastRoom(code);
        for (const p of room.players) sendPrivateCards(code, p.id);
      }
    }
  });

  socket.on('REQUEST_TRADE', ({ targetPlayerId, fromChipValue, toChipValue }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const result = requestTrade(room, socket.id, targetPlayerId, fromChipValue, toChipValue);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);
  });

  socket.on('RESPOND_TRADE', ({ accept }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const result = respondToTrade(room, socket.id, accept);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);
  });

  socket.on('ADVANCE_SHOWDOWN', () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (room.gameState !== PHASES.SHOWDOWN) return;

    const result = processShowdownStep(room);
    const step = getShowdownStep(room);

    if (result.gameOver) {
      io.to(code).emit('GAME_OVER', {
        result: result.result,
        winner: room.gameMode === GAME_MODES.IMPOSTER
          ? (result.result === 'WIN' ? 'CREW' : 'IMPOSTER')
          : null,
        gameMode: room.gameMode,
        imposterPlayerId: room.gameMode === GAME_MODES.IMPOSTER ? room.imposterPlayerId : null,
        vault: room.vault,
        alarms: room.alarms,
      });
      broadcastRoom(code);
      return;
    }
    if (result.heistResult) {
      io.to(code).emit('HEIST_RESULT', { success: result.success });
      broadcastRoom(code);
      return;
    }

    sendShowdownStep(code, room);
    broadcastRoom(code);
  });

  socket.on('NEXT_HEIST', () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (room.hostId !== socket.id) return;
    if (room.gameState !== PHASES.HEIST_RESULT) return;
    startNextHeist(room);
    broadcastRoom(code);
    for (const p of room.players) sendPrivateCards(code, p.id);
    sendPrivateModeState(code);
  });

  socket.on('RETURN_TO_LOBBY', () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (room.hostId !== socket.id) {
      socket.emit('ERROR', { message: 'Chá»‰ host má»›i cÃ³ thá»ƒ quay vá» lobby' });
      return;
    }
    const result = returnToLobby(room);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);
  });

  socket.on('SET_CHALLENGES', ({ challenges }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (room.hostId !== socket.id) return;
    if (room.gameState !== PHASES.LOBBY) return;
    const allowedIds = room.gameMode === GAME_MODES.IMPOSTER
      ? new Set(IMPOSTER_CHALLENGE_DEFS.map((challenge) => challenge.id))
      : new Set(CHALLENGE_DEFS.map((challenge) => challenge.id));
    const requested = Array.isArray(challenges) ? challenges : [];
    if (requested.some((id) => !allowedIds.has(id))) {
      socket.emit('ERROR', { message: 'One or more challenges are invalid for this mode' });
      return;
    }
    room.challenges = [...new Set(requested)];
    broadcastRoom(code);
  });

  socket.on('SET_GAME_MODE', ({ gameMode } = {}) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (room.hostId !== socket.id) return;
    const result = setGameMode(room, gameMode);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);
  });

  socket.on('IMPOSTER_ADVICE', ({ targetPlayerId, suggestedChipValue } = {}) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const result = submitImposterAdvice(room, socket.id, targetPlayerId, suggestedChipValue);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }

    io.to(result.targetId).emit('FALSE_TRAIL_ADVICE', result.advice);
    broadcastRoom(code);
    socket.emit('PRIVATE_CHALLENGE_STATE', getPrivateChallengeData(room, socket.id));
  });

  socket.on('CREW_REROUTE', ({ replacementChipValue } = {}) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const result = useCrewReroute(room, socket.id, replacementChipValue);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);
    sendPrivateModeState(code);
  });

  socket.on('REQUEST_CREW_VERIFICATION', ({ targetPlayerId, verifierPlayerId } = {}) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const result = requestCrewVerification(room, socket.id, targetPlayerId, verifierPlayerId);
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    io.to(result.request.verifierPlayerId).emit('CREW_VERIFICATION_REQUEST', result.request);
    io.to(result.request.requesterId).emit('CREW_VERIFICATION_SENT', result.request);
    broadcastRoom(code);
    sendPrivateModeState(code);
  });

  socket.on('RESPOND_CREW_VERIFICATION', ({ requestId, accepted } = {}) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { room } = found;
    const result = respondCrewVerification(room, socket.id, requestId, Boolean(accepted));
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    for (const recipientId of result.recipientIds) {
      io.to(recipientId).emit('CREW_VERIFICATION_RESULT', result.result);
    }
  });

  socket.on('SEND_EMOTE', ({ emoteId, targetPlayerId }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (room.silentAlarm && room.gameState === PHASES.SHOWDOWN) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    io.to(code).emit('EMOTE_RECEIVED', {
      fromId: socket.id,
      fromName: player.name,
      emoteId,
      text: EMOTES[emoteId] || emoteId,
      targetPlayerId,
    });
  });

  socket.on('SUBMIT_GUESS', ({ cardRank, handRank, confirm = false }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const result = submitGuess(room, socket.id, { cardRank, handRank, confirm });
    if (result.error) {
      socket.emit('ERROR', { message: result.error });
      return;
    }
    broadcastRoom(code);
    if (result.guessConfirmed) {
      sendShowdownStep(code, room);
    }
  });

  socket.on('disconnect', () => {
    for (const [code, room] of Object.entries(rooms)) {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx !== -1) {
        if (room.crewVerificationRequest && [
          room.crewVerificationRequest.requesterId,
          room.crewVerificationRequest.targetPlayerId,
          room.crewVerificationRequest.verifierPlayerId,
        ].includes(socket.id)) {
          room.crewVerificationRequest = null;
        }
        if (room.gameState === PHASES.LOBBY) {
          room.players.splice(idx, 1);
          if (room.players.length === 0) {
            delete rooms[code];
          } else {
            if (room.hostId === socket.id) {
              room.hostId = room.players[0].id;
            }
            broadcastRoom(code);
          }
        } else {
          room.players[idx].connected = false;
          broadcastRoom(code);
        }
        break;
      }
    }
  });
});

app.get('/health', (_, res) => res.json({ ok: true }));

const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/socket.io')) return;
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ message: 'Client not built yet' });
  });
});

server.listen(PORT, () => {
  console.log(`The Gang server running on port ${PORT}`);
});
