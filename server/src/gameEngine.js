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
    roundSelections: {},
    roundConfirmed: {},
    tradeOffer: null,
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
  room.roundSelections = {};
  room.roundConfirmed = {};
  room.tradeOffer = null;
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

export const CARD_RANK_OPTIONS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const HAND_RANK_OPTIONS = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
];

function startShowdown(room) {
  const redChips = room.players
    .map((p) => ({ id: p.id, chip: p.chips.red ?? 999 }))
    .sort((a, b) => a.chip - b.chip);
  room.showdownOrder = redChips.map((r) => r.id);
  room.showdownIndex = 0;

  if (needsPreShowdownGuess(room)) {
    initGuessPhase(room);
    return;
  }

  room.gameState = PHASES.SHOWDOWN;
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
    startedAt: Date.now(),
    expiresAt: Date.now() + 30000,
  };
  addLog(room, `Retina/Fingerprint Scan — đoán bài của ${target.name} trước khi lật`);
}

function buildVoteSummary(votes, key) {
  const counts = {};
  for (const vote of Object.values(votes || {})) {
    if (!vote || vote[key] == null || vote[key] === undefined) continue;
    counts[vote[key]] = (counts[vote[key]] || 0) + 1;
  }
  return counts;
}

function resolveGuessPhase(room, reason = 'finalized') {
  const gp = room.guessPhase;
  if (!gp) return { ok: true };

  const voters = room.players.filter((p) => p.id !== gp.targetPlayerId);
  const allVotes = voters.map((p) => gp.votes[p.id]).filter(Boolean);

  if (gp.needRetina) {
    const retinaVotes = allVotes
      .map((vote) => vote.cardRank)
      .filter((value) => value != null);
    gp.retinaGuess = chooseMajorityVote(retinaVotes, retinaVotes[0] ?? null);
  }

  if (gp.needFingerprint) {
    const fingerprintVotes = allVotes
      .map((vote) => vote.handRank)
      .filter((value) => value != null);
    gp.fingerprintGuess = chooseMajorityVote(fingerprintVotes, fingerprintVotes[0] ?? null);
  }

  gp.confirmed = true;
  gp.resolvedAt = Date.now();
  gp.reason = reason;
  room.gameState = PHASES.SHOWDOWN;
  addLog(
    room,
    `Đoán đã thống nhất — Retina ${gp.retinaGuess ?? '—'} | Fingerprint ${gp.fingerprintGuess ?? '—'} | lật bài ${gp.targetName}`
  );
  return { ok: true, guessConfirmed: true, reason };
}

export function getShowdownStep(room) {
  if (room.gameState === PHASES.SHOWDOWN_GUESS) {
    return { needsGuess: true, guessPhase: sanitizeGuessPhase(room, room.lastViewerId) };
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

function chooseMajorityVote(votes, fallback) {
  if (!votes || votes.length === 0) return fallback ?? null;
  const counts = {};
  for (const vote of votes) {
    if (vote == null) continue;
    counts[vote] = (counts[vote] || 0) + 1;
  }

  const entries = Object.entries(counts);
  if (entries.length === 0) return fallback ?? null;

  const max = Math.max(...entries.map(([, count]) => count));
  const winners = entries.filter(([, count]) => count === max).map(([value]) => value);
  return winners[Math.floor(Math.random() * winners.length)];
}

function sanitizeGuessPhase(room, viewerId = room.lastViewerId) {
  const gp = room.guessPhase;
  if (!gp) return null;

  if (!gp.confirmed && gp.expiresAt && Date.now() >= gp.expiresAt) {
    resolveGuessPhase(room, 'timeout');
  }

  const voters = room.players.filter((p) => p.id !== gp.targetPlayerId);
  const myVote = gp.votes[viewerId] || null;
  return {
    targetPlayerId: gp.targetPlayerId,
    targetName: gp.targetName,
    needRetina: gp.needRetina,
    needFingerprint: gp.needFingerprint,
    voteCount: Object.keys(gp.votes).length,
    voterCount: voters.length,
    confirmed: gp.confirmed,
    resolvedRetinaGuess: gp.retinaGuess ?? null,
    resolvedFingerprintGuess: gp.fingerprintGuess ?? null,
    myVote,
    myVoteLocked: !!myVote?.confirmed,
    expiresAt: gp.expiresAt,
    timerMs: Math.max(0, (gp.expiresAt ?? 0) - Date.now()),
    allConfirmed: voters.every((p) => !!gp.votes[p.id]?.confirmed),
    voteCounts: {
      retina: buildVoteSummary(gp.votes, 'cardRank'),
      fingerprint: buildVoteSummary(gp.votes, 'handRank'),
    },
    playerVotes: room.players
      .filter((p) => p.id !== gp.targetPlayerId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        vote: gp.votes[p.id] || null,
      })),
    options: {
      retina: gp.needRetina ? [...CARD_RANK_OPTIONS] : [],
      fingerprint: gp.needFingerprint ? [...HAND_RANK_OPTIONS] : [],
    },
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

export function submitGuess(room, playerId, { cardRank, handRank, confirm = false }) {
  if (room.gameState !== PHASES.SHOWDOWN_GUESS || !room.guessPhase) {
    return { error: 'Không trong giai đoạn đoán' };
  }

  const gp = room.guessPhase;
  if (playerId === gp.targetPlayerId) {
    return { error: 'Người bị đoán không được tham gia' };
  }

  const existing = gp.votes[playerId] || { cardRank: null, handRank: null, confirmed: false };

  if (!confirm) {
    if (gp.needRetina) existing.cardRank = cardRank ?? null;
    if (gp.needFingerprint) existing.handRank = handRank ?? null;
    existing.confirmed = false;
  } else {
    if (gp.needRetina && cardRank != null) {
      existing.cardRank = cardRank;
    }
    if (gp.needFingerprint && handRank != null) {
      existing.handRank = handRank;
    }
  }

  if (confirm) {
    if (gp.needRetina && !existing.cardRank) {
      return { error: 'Chọn giá trị lá bài (Retina Scan)' };
    }
    if (gp.needFingerprint && !existing.handRank) {
      return { error: 'Chọn hạng bài (Fingerprint Scan)' };
    }
    existing.confirmed = true;
  }

  gp.votes[playerId] = existing;

  const voters = room.players.filter((p) => p.id !== gp.targetPlayerId);
  const allConfirmed = voters.every((p) => !!gp.votes[p.id]?.confirmed);
  const expired = Date.now() >= (gp.expiresAt ?? Date.now() + 30000);

  if (allConfirmed || expired) {
    return resolveGuessPhase(room, allConfirmed ? 'all_confirmed' : 'timeout');
  }

  return {
    ok: true,
    waiting: true,
    allConfirmed: false,
    locked: !!existing.confirmed,
    myVote: gp.votes[playerId],
  };
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
  room.leaderboard = room.players
    .map((p) => ({
      id: p.id,
      name: p.name,
      hand: evaluateBestHand(p.cards, room.communityCards),
      placement: 0,
    }))
    .sort((a, b) => compareHands(b.hand, a.hand))
    .map((entry, index) => ({ ...entry, placement: index + 1 }));

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

function allPlayersConfirmed(room) {
  return room.players.length > 0 && room.players.every((p) => !!room.roundConfirmed[p.id]);
}

function commitConfirmedChipRound(room) {
  const color = room.currentChipColor;
  if (!color) return { ok: true };

  for (const player of room.players) {
    const value = room.roundSelections[player.id];
    if (value == null) continue;
    player.chips[color] = value;
  }

  room.availableChips = [];
  room.roundSelections = {};
  room.roundConfirmed = {};
  room.tradeOffer = null;

  return { ok: true, allReady: allPlayersHaveChip(room) };
}

export function returnChipToCenter(room, playerId) {
  const color = room.currentChipColor;
  if (!color) return { error: 'Không có chip round này' };
  if (room.roundConfirmed[playerId]) {
    return { error: 'Bạn đã xác nhận chip, không thể trả chip về trung tâm' };
  }

  const selected = room.roundSelections[playerId];
  if (selected == null) {
    return { ok: true, returned: false };
  }

  delete room.roundSelections[playerId];
  if (!room.availableChips.includes(selected)) {
    room.availableChips.push(selected);
    room.availableChips.sort((a, b) => a - b);
  }

  room.roundConfirmed[playerId] = false;
  return { ok: true, returned: true, chipValue: selected };
}

export function confirmChipSelection(room, playerId) {
  const color = room.currentChipColor;
  if (!color) return { error: 'Không có chip round này' };
  if (room.roundSelections[playerId] == null) {
    return { error: 'Bạn chưa chọn chip' };
  }
  if (room.roundConfirmed[playerId]) {
    return { ok: true, allConfirmed: allPlayersConfirmed(room) };
  }

  room.roundConfirmed[playerId] = true;
  if (allPlayersConfirmed(room)) {
    const result = commitConfirmedChipRound(room);
    return { ok: true, allConfirmed: true, ...result };
  }

  return { ok: true, allConfirmed: false, confirmedCount: Object.values(room.roundConfirmed).filter(Boolean).length };
}

export function requestTrade(room, fromPlayerId, toPlayerId, fromChipValue, toChipValue) {
  if (fromPlayerId === toPlayerId) return { error: 'Không thể trade với chính mình' };
  if (room.roundConfirmed[fromPlayerId] || room.roundConfirmed[toPlayerId]) {
    return { error: 'Không thể trade sau khi đã xác nhận chip' };
  }

  const fromSelected = room.roundSelections[fromPlayerId] ?? fromChipValue;
  const toSelected = room.roundSelections[toPlayerId] ?? toChipValue;
  if (fromSelected == null) return { error: 'Bạn chưa chọn chip để trade' };
  if (toSelected == null) return { error: 'Người kia chưa chọn chip để trade' };

  room.tradeOffer = {
    fromPlayerId,
    toPlayerId,
    fromChipValue: fromSelected,
    toChipValue: toSelected,
    expiresAt: Date.now() + 15000,
    status: 'pending',
  };

  return { ok: true, tradeOffer: room.tradeOffer };
}

export function respondToTrade(room, playerId, accept) {
  const offer = room.tradeOffer;
  if (!offer) return { error: 'Không có request trade' };
  if (playerId !== offer.toPlayerId) return { error: 'Chỉ người được mời mới trả lời trade' };

  if (!accept) {
    room.tradeOffer = null;
    return { ok: true, accepted: false };
  }

  room.roundSelections[offer.fromPlayerId] = offer.toChipValue;
  room.roundSelections[offer.toPlayerId] = offer.fromChipValue;
  room.tradeOffer = null;
  return { ok: true, accepted: true };
}

export function selectChip(room, playerId, chipValue, targetPlayerId = null) {
  const color = room.currentChipColor;
  if (!color) return { error: 'Không có chip round này' };

  if (targetPlayerId) {
    return { error: 'Trao đổi chip phải dùng request trade, không steal trực tiếp' };
  }

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: 'Người chơi không tồn tại' };

  if (room.roundConfirmed[playerId]) {
    return { error: 'Bạn đã xác nhận chip, không thể đổi nữa' };
  }

  const available = room.availableChips || [];
  if (!available.includes(chipValue)) {
    return { error: 'Chip không còn trong pool' };
  }

  const previous = room.roundSelections[playerId];
  if (previous != null && previous !== chipValue) {
    room.availableChips.push(previous);
    room.availableChips.sort((a, b) => a - b);
  }

  room.roundSelections[playerId] = chipValue;
  room.availableChips = room.availableChips.filter((c) => c !== chipValue);
  room.roundConfirmed[playerId] = false;

  if (shouldLockChip(room, chipValue)) {
    room.lockedChips.add(chipValue);
    const reason = chipValue === 1 ? 'Noise Sensors' : 'Ventilation Shaft';
    addLog(room, `Chip ${chipValue} bị khóa (${reason})`);
  }

  addLog(room, `${player.name} chọn chip ${chipValue}`);

  const ready = allPlayersConfirmed(room);
  return { ok: true, allReady: ready, selectedChip: chipValue };
}

export function sanitizeRoomForClient(room, viewerId) {
  if (room.gameState === PHASES.SHOWDOWN_GUESS && room.guessPhase && !room.guessPhase.confirmed && Date.now() >= (room.guessPhase.expiresAt ?? 0)) {
    resolveGuessPhase(room, 'timeout');
  }

  if (room.tradeOffer && room.tradeOffer.expiresAt <= Date.now()) {
    room.tradeOffer = null;
  }

  const guessSanitized = room.guessPhase
    ? {
      ...sanitizeGuessPhase(room, viewerId),
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
    leaderboard: room.leaderboard || [],
    roundSelections: room.roundSelections || {},
    roundConfirmed: room.roundConfirmed || {},
    tradeOffer: room.tradeOffer && room.tradeOffer.expiresAt > Date.now() ? {
      ...room.tradeOffer,
      expiresAt: room.tradeOffer.expiresAt,
      timeLeftMs: Math.max(0, room.tradeOffer.expiresAt - Date.now()),
    } : null,
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
