import { createDeck, shuffleDeck } from './deck.js';
import { evaluateBestHand, compareHands } from './handEvaluator.js';
import { shouldLockChip, hasChallenge } from './challenges.js';

export const PHASES = {
  LOBBY: 'LOBBY',
  PRE_FLOP: 'PRE_FLOP',
  FLOP: 'FLOP',
  TURN: 'TURN',
  RIVER: 'RIVER',
  SHOWDOWN: 'SHOWDOWN',
  SHOWDOWN_GUESS: 'SHOWDOWN_GUESS',
  HEIST_RESULT: 'HEIST_RESULT',
  GAME_OVER: 'GAME_OVER',
};

const CHIP_COLORS = {
  PRE_FLOP: 'white',
  FLOP: 'yellow',
  TURN: 'orange',
  RIVER: 'red',
};

const PHASE_ORDER = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'];

export function generateRoomCode(rooms) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return rooms[code] ? generateRoomCode(rooms) : code;
}

export function createRoom(hostId, playerName, maxPlayers = 6) {
  return {
    code: null,
    hostId,
    maxPlayers,
    players: [
      {
        id: hostId,
        name: playerName,
        cards: [],
        chips: {},
        connected: true,
      },
    ],
    gameState: PHASES.LOBBY,
    deck: [],
    communityCards: [],
    challenges: [],
    vault: 0,
    alarms: 0,
    heistNumber: 1,
    currentChipColor: null,
    availableChips: [],
    lockedChips: new Set(),
    showdownOrder: [],
    showdownIndex: 0,
    lastHeistSuccess: null,
    gameLog: [],
    guessPhase: null,
  };
}

function getChipColor(phase) {
  return CHIP_COLORS[phase] || null;
}

function initChipPool(room) {
  const n = room.players.length;
  room.availableChips = Array.from({ length: n }, (_, i) => i + 1);
  room.currentChipColor = getChipColor(room.gameState);
  room.lockedChips = new Set();
}

function allPlayersHaveChip(room) {
  const color = room.currentChipColor;
  if (!color) return false;
  return room.players.every((p) => p.chips[color] != null);
}

function dealPocketCards(room) {
  room.deck = shuffleDeck(createDeck());
  const cardCount = hasChallenge(room, 'securityCamera') ? 3 : 2;
  for (const player of room.players) {
    player.cards = room.deck.splice(0, cardCount);
    player.chips = {};
  }
  room.communityCards = [];
}

function redrawPocketCards(room, player) {
  const count = player.cards.length;
  room.deck.push(...player.cards);
  player.cards = room.deck.splice(0, count);
}

function revealCommunity(room, count) {
  const newCards = room.deck.splice(0, count);
  room.communityCards.push(...newCards);
  return newCards;
}

function applyFlopChallenges(room) {
  if (hasChallenge(room, 'quickAccess')) return;

  const flop = room.communityCards.slice(0, 3);
  const hasFace = flop.some((c) => ['J', 'Q', 'K'].includes(c.rank));
  const n = room.players.length;

  if (hasChallenge(room, 'motionDetector') && hasFace) {
    const holder = room.players.find((p) => p.chips.white === 1);
    if (holder) {
      redrawPocketCards(room, holder);
      addLog(room, `${holder.name} — Motion Detector: bài mới (không ai thấy)`);
    }
  }

  if (hasChallenge(room, 'laserTripwires') && !hasFace) {
    const holder = room.players.find((p) => p.chips.white === n);
    if (holder) {
      redrawPocketCards(room, holder);
      addLog(room, `${holder.name} — Laser Tripwires: bài mới (không ai thấy)`);
    }
  }
}

function addLog(room, message) {
  room.gameLog.push({ time: Date.now(), message });
  if (room.gameLog.length > 50) room.gameLog.shift();
}

function applyBlackout(room, newPhase) {
  if (!hasChallenge(room, 'blackout')) return;
  const prevColor = getPreviousChipColor(newPhase);
  if (!prevColor) return;
  for (const p of room.players) {
    delete p.chips[prevColor];
  }
  addLog(room, `Blackout — chip ${prevColor} đã bị ẩn`);
}

export function startGame(room) {
  if (room.players.length < 3) return { error: 'Cần ít nhất 3 người chơi' };
  if (room.gameState !== PHASES.LOBBY) return { error: 'Game đã bắt đầu' };

  dealPocketCards(room);
  room.guessPhase = null;

  if (hasChallenge(room, 'quickAccess')) {
    revealCommunity(room, 3);
    room.gameState = PHASES.FLOP;
  } else {
    room.gameState = PHASES.PRE_FLOP;
  }

  initChipPool(room);
  addLog(room, `Heist #${room.heistNumber} bắt đầu!`);
  logActiveChallenges(room);
  return { ok: true };
}

function logActiveChallenges(room) {
  if (room.challenges.length === 0) return;
  addLog(room, `Thử thách: ${room.challenges.length} đang active`);
}

export function advancePhase(room) {
  const current = room.gameState;

  if (current === PHASES.PRE_FLOP) {
    revealCommunity(room, 3);
    room.gameState = PHASES.FLOP;
    applyFlopChallenges(room);
  } else if (current === PHASES.FLOP) {
    if (hasChallenge(room, 'hastyGetaway')) {
      revealCommunity(room, 2);
      room.gameState = PHASES.RIVER;
    } else {
      revealCommunity(room, 1);
      room.gameState = PHASES.TURN;
    }
  } else if (current === PHASES.TURN) {
    revealCommunity(room, 1);
    room.gameState = PHASES.RIVER;
  } else if (current === PHASES.RIVER) {
    room.gameState = PHASES.SHOWDOWN;
    startShowdown(room);
    return { ok: true, showdown: true };
  } else {
    return { error: 'Không thể chuyển phase' };
  }

  applyBlackout(room, room.gameState);
  initChipPool(room);
  addLog(room, `Phase: ${room.gameState}`);
  return { ok: true };
}

function getPreviousChipColor(currentPhase) {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  if (idx <= 0) return null;
  return CHIP_COLORS[PHASE_ORDER[idx - 1]];
}

function getHighestRedChipPlayerId(room) {
  const n = room.players.length;
  const holder = room.players.find((p) => p.chips.red === n);
  return holder?.id ?? room.showdownOrder[room.showdownOrder.length - 1];
}

function needsPreShowdownGuess(room) {
  return (
    hasChallenge(room, 'retinaScan') || hasChallenge(room, 'fingerprintScan')
  );
}

function startShowdown(room) {
  const redChips = room.players
    .map((p) => ({ id: p.id, chip: p.chips.red ?? 999 }))
    .sort((a, b) => a.chip - b.chip);
  room.showdownOrder = redChips.map((r) => r.id);
  room.showdownIndex = 0;
  room.guessPhase = null;
  addLog(room, 'Showdown! Xếp hạng theo chip đỏ (1→N)...');
}

function initGuessPhase(room) {
  const targetId = getHighestRedChipPlayerId(room);
  const target = room.players.find((p) => p.id === targetId);
  room.gameState = PHASES.SHOWDOWN_GUESS;
  room.guessPhase = {
    targetPlayerId: targetId,
    targetName: target.name,
    needRetina: hasChallenge(room, 'retinaScan'),
    needFingerprint: hasChallenge(room, 'fingerprintScan'),
    votes: {},
    confirmed: false,
    retinaGuess: null,
    fingerprintGuess: null,
  };
  addLog(room, `Retina/Fingerprint Scan — đoán bài của ${target.name} trước khi lật`);
}

export function getShowdownStep(room) {
  if (room.gameState === PHASES.SHOWDOWN_GUESS) {
    return { needsGuess: true, guessPhase: sanitizeGuessPhase(room) };
  }

  if (room.gameState !== PHASES.SHOWDOWN) return null;
  if (room.showdownIndex >= room.showdownOrder.length) {
    return { done: true };
  }

  const playerId = room.showdownOrder[room.showdownIndex];
  const player = room.players.find((p) => p.id === playerId);
  const hand = evaluateBestHand(player.cards, room.communityCards);
  const isLast = room.showdownIndex === room.showdownOrder.length - 1;

  return {
    playerId,
    playerName: player.name,
    cards: player.cards,
    hand,
    index: room.showdownIndex,
    total: room.showdownOrder.length,
    isLast,
  };
}

function sanitizeGuessPhase(room) {
  const gp = room.guessPhase;
  if (!gp) return null;
  const voters = room.players.filter((p) => p.id !== gp.targetPlayerId);
  return {
    targetPlayerId: gp.targetPlayerId,
    targetName: gp.targetName,
    needRetina: gp.needRetina,
    needFingerprint: gp.needFingerprint,
    voteCount: Object.keys(gp.votes).length,
    voterCount: voters.length,
    confirmed: gp.confirmed,
    myVote: null,
  };
}

function validateRetinaGuess(room, guess) {
  const target = room.players.find((p) => p.id === room.guessPhase.targetPlayerId);
  return target.cards.some((c) => c.rank === guess);
}

function validateFingerprintGuess(room, guess) {
  const target = room.players.find((p) => p.id === room.guessPhase.targetPlayerId);
  const hand = evaluateBestHand(target.cards, room.communityCards);
  return hand.name === guess;
}

export function submitGuess(room, playerId, { cardRank, handRank }) {
  if (room.gameState !== PHASES.SHOWDOWN_GUESS || !room.guessPhase) {
    return { error: 'Không trong giai đoạn đoán' };
  }

  const gp = room.guessPhase;
  if (playerId === gp.targetPlayerId) {
    return { error: 'Người bị đoán không được tham gia' };
  }

  if (gp.needRetina && !cardRank) {
    return { error: 'Chọn giá trị lá bài (Retina Scan)' };
  }
  if (gp.needFingerprint && !handRank) {
    return { error: 'Chọn hạng bài (Fingerprint Scan)' };
  }

  gp.votes[playerId] = { cardRank: cardRank || null, handRank: handRank || null };

  const voters = room.players.filter((p) => p.id !== gp.targetPlayerId);
  const allVoted = voters.every((p) => gp.votes[p.id]);

  if (!allVoted) {
    return { ok: true, waiting: true };
  }

  const retinaVotes = gp.needRetina
    ? [...new Set(voters.map((p) => gp.votes[p.id].cardRank))]
    : [];
  const fingerprintVotes = gp.needFingerprint
    ? [...new Set(voters.map((p) => gp.votes[p.id].handRank))]
    : [];

  if (gp.needRetina && retinaVotes.length !== 1) {
    gp.votes = {};
    return { error: 'Chưa thống nhất giá trị lá (Retina Scan) — hãy bỏ phiếu lại' };
  }
  if (gp.needFingerprint && fingerprintVotes.length !== 1) {
    gp.votes = {};
    return { error: 'Chưa thống nhất hạng bài (Fingerprint Scan) — hãy bỏ phiếu lại' };
  }

  gp.retinaGuess = gp.needRetina ? retinaVotes[0] : null;
  gp.fingerprintGuess = gp.needFingerprint ? fingerprintVotes[0] : null;
  gp.confirmed = true;

  room.gameState = PHASES.SHOWDOWN;
  addLog(room, `Đoán đã thống nhất — lật bài ${gp.targetName}`);

  return { ok: true, guessConfirmed: true };
}

export function processShowdownStep(room) {
  const isLastStep = room.showdownIndex === room.showdownOrder.length - 1;

  if (
    isLastStep &&
    needsPreShowdownGuess(room) &&
    !room.guessPhase?.confirmed
  ) {
    initGuessPhase(room);
    return { ok: true, needsGuess: true };
  }

  const step = getShowdownStep(room);
  if (!step || step.done) return finishShowdown(room);

  const player = room.players.find((p) => p.id === step.playerId);
  const hand = evaluateBestHand(player.cards, room.communityCards);

  if (step.isLast && room.guessPhase?.confirmed) {
    let guessFail = false;
    if (room.guessPhase.needRetina && !validateRetinaGuess(room, room.guessPhase.retinaGuess)) {
      addLog(room, `Retina Scan SAI (đoán ${room.guessPhase.retinaGuess}) — Heist thất bại!`);
      guessFail = true;
    }
    if (
      !guessFail &&
      room.guessPhase.needFingerprint &&
      !validateFingerprintGuess(room, room.guessPhase.fingerprintGuess)
    ) {
      addLog(
        room,
        `Fingerprint Scan SAI (đoán ${room.guessPhase.fingerprintGuess}, thực tế ${hand.name}) — Heist thất bại!`
      );
      guessFail = true;
    }
    if (guessFail) {
      room.showdownIndex++;
      return finishShowdown(room, false);
    }
    addLog(room, 'Retina/Fingerprint Scan — đoán đúng!');
  }

  let valid = true;
  if (room.showdownIndex > 0) {
    const prevId = room.showdownOrder[room.showdownIndex - 1];
    const prevPlayer = room.players.find((p) => p.id === prevId);
    const prevHand = evaluateBestHand(prevPlayer.cards, room.communityCards);
    if (compareHands(hand, prevHand) < 0) {
      valid = false;
    }
  }

  room.showdownIndex++;
  const isLast = room.showdownIndex >= room.showdownOrder.length;

  if (isLast && !valid) return finishShowdown(room, false);
  if (isLast && valid) return finishShowdown(room, true);
  if (!valid) return finishShowdown(room, false);

  return { ok: true, step, continue: true };
}

function finishShowdown(room, success) {
  room.guessPhase = null;

  if (success) {
    room.vault++;
    room.lastHeistSuccess = true;
    addLog(room, `Heist #${room.heistNumber} THÀNH CÔNG! (${room.vault}/3)`);
  } else {
    room.alarms++;
    room.lastHeistSuccess = false;
    addLog(room, `Heist #${room.heistNumber} THẤT BẠI! (${room.alarms}/3)`);
  }

  if (room.vault >= 3) {
    room.gameState = PHASES.GAME_OVER;
    return { ok: true, gameOver: true, result: 'WIN' };
  }
  if (room.alarms >= 3) {
    room.gameState = PHASES.GAME_OVER;
    return { ok: true, gameOver: true, result: 'LOSE' };
  }

  room.gameState = PHASES.HEIST_RESULT;
  return { ok: true, heistResult: true, success };
}

export function startNextHeist(room) {
  room.heistNumber++;
  dealPocketCards(room);
  room.guessPhase = null;

  if (hasChallenge(room, 'quickAccess')) {
    revealCommunity(room, 3);
    room.gameState = PHASES.FLOP;
  } else {
    room.gameState = PHASES.PRE_FLOP;
  }

  initChipPool(room);
  room.showdownOrder = [];
  room.showdownIndex = 0;
  addLog(room, `Heist #${room.heistNumber} bắt đầu!`);
  return { ok: true };
}

function isChipLocked(room, chipValue) {
  return room.lockedChips.has(chipValue);
}

export function selectChip(room, playerId, chipValue, targetPlayerId = null) {
  const color = room.currentChipColor;
  if (!color) return { error: 'Không có chip round này' };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: 'Người chơi không tồn tại' };

  const myChip = player.chips[color];

  if (targetPlayerId) {
    const target = room.players.find((p) => p.id === targetPlayerId);
    if (!target) return { error: 'Đối thủ không tồn tại' };
    if (target.chips[color] !== chipValue) return { error: 'Chip không hợp lệ' };
    if (isChipLocked(room, chipValue)) {
      return { error: 'Chip này bị khóa (Noise Sensor / Ventilation Shaft)' };
    }
    if (myChip != null && isChipLocked(room, myChip)) {
      return { error: 'Chip của bạn bị khóa, không thể đổi' };
    }

    if (myChip != null) {
      target.chips[color] = myChip;
    } else {
      delete target.chips[color];
    }
    player.chips[color] = chipValue;

    if (myChip != null && !room.availableChips.includes(myChip)) {
      room.availableChips.push(myChip);
      room.availableChips.sort((a, b) => a - b);
    }
    room.availableChips = room.availableChips.filter((c) => c !== chipValue);

    addLog(room, `${player.name} cướp chip ${chipValue} từ ${target.name}`);
  } else {
    if (!room.availableChips.includes(chipValue)) {
      return { error: 'Chip không còn trong pool' };
    }
    if (myChip != null && isChipLocked(room, myChip)) {
      return { error: 'Chip của bạn bị khóa, không thể trả về pool' };
    }

    if (myChip != null) {
      room.availableChips.push(myChip);
      room.availableChips.sort((a, b) => a - b);
    }

    player.chips[color] = chipValue;
    room.availableChips = room.availableChips.filter((c) => c !== chipValue);

    if (shouldLockChip(room, chipValue)) {
      room.lockedChips.add(chipValue);
      const reason = chipValue === 1 ? 'Noise Sensors' : 'Ventilation Shaft';
      addLog(room, `Chip ${chipValue} bị khóa (${reason})`);
    }

    addLog(room, `${player.name} lấy chip ${chipValue}`);
  }

  const ready = allPlayersHaveChip(room);
  return { ok: true, allReady: ready };
}

export function sanitizeRoomForClient(room, viewerId) {
  const guessSanitized = room.guessPhase
    ? {
        ...sanitizeGuessPhase(room),
        myVote: room.guessPhase.votes[viewerId] || null,
        isTarget: room.guessPhase.targetPlayerId === viewerId,
      }
    : null;

  return {
    code: room.code,
    hostId: room.hostId,
    gameState: room.gameState,
    communityCards: room.communityCards,
    vault: room.vault,
    alarms: room.alarms,
    heistNumber: room.heistNumber,
    currentChipColor: room.currentChipColor,
    availableChips: room.availableChips,
    lockedChips: [...room.lockedChips],
    lastHeistSuccess: room.lastHeistSuccess,
    challenges: room.challenges,
    gameLog: room.gameLog,
    showdownIndex: room.showdownIndex,
    showdownOrder: room.showdownOrder,
    guessPhase: guessSanitized,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      chips: shouldHideChips(room) ? filterVisibleChips(p.chips, room) : { ...p.chips },
      cardCount: p.cards.length,
      cards: getVisibleCards(room, p, viewerId),
      isHost: p.id === room.hostId,
    })),
  };
}

function shouldHideChips(room) {
  return hasChallenge(room, 'blackout');
}

function filterVisibleChips(chips, room) {
  const color = room.currentChipColor;
  if (!color) return {};
  const visible = {};
  if (chips[color] != null) visible[color] = chips[color];
  return visible;
}

function getVisibleCards(room, player, viewerId) {
  if (
    room.gameState === PHASES.SHOWDOWN &&
    room.showdownOrder.slice(0, room.showdownIndex).includes(player.id)
  ) {
    return player.cards;
  }
  if (player.id === viewerId || room.gameState === PHASES.GAME_OVER) {
    return player.cards;
  }
  return null;
}

export function getPlayerCards(room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  return player ? player.cards : [];
}

export { CHIP_COLORS, allPlayersHaveChip };
