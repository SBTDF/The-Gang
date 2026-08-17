import { createDeck, shuffleDeck } from './deck.js';
import { evaluateBestHand, compareHands } from './handEvaluator.js';
import { shouldLockChip, hasChallenge } from './challenges.js';
import {
  GAME_MODES,
  createChallengeProgress,
  incrementChallengeProgress,
  IMPOSTER_ADVICE_DEFS,
  isImposterMode,
  isSupportedGameMode,
  randomItem,
  resetChallengeUses,
} from './imposterMode.js';

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
const IMPOSTER_ACTION_PHASES = new Set(PHASE_ORDER);

function canUseImposterAction(room) {
  return isImposterMode(room) && IMPOSTER_ACTION_PHASES.has(room.gameState);
}

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
    gameMode: GAME_MODES.CLASSIC,
    players: [
      {
        id: hostId,
        name: playerName,
        cards: [],
        publicShowdownCards: [],
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
    hiddenCommunityCardIndex: null,
    imposterPlayerId: null,
    challengeProgress: {},
    publicSabotageHistory: [],
    privateChallengeData: {},
  };
}

export function setGameMode(room, gameMode) {
  if (room.gameState !== PHASES.LOBBY) {
    return { error: 'Game mode can only be changed in the lobby' };
  }
  if (!isSupportedGameMode(gameMode)) {
    return { error: 'Game mode is invalid' };
  }

  room.gameMode = gameMode;
  room.challenges = [];
  room.imposterPlayerId = null;
  room.challengeProgress = {};
  room.publicSabotageHistory = [];
  room.privateChallengeData = {};
  delete room.revealedImposterId;
  for (const player of room.players) {
    player.publicShowdownCards = [];
  }
  return { ok: true };
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
  room.hiddenCommunityCardIndex = null;
  const cardCount = hasChallenge(room, 'securityCamera') ? 3 : 2;
  for (const player of room.players) {
    player.cards = room.deck.splice(0, cardCount);
    player.publicShowdownCards = [];
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

function applySignalInterference(room, revealedCards) {
  if (!hasChallenge(room, 'silentAlarm') || !revealedCards.length) return;
  const hiddenIndex = Math.floor(Math.random() * revealedCards.length);
  const hiddenCard = revealedCards[hiddenIndex];
  const actualIndex = room.communityCards.length - revealedCards.length + hiddenIndex;
  room.communityCards[actualIndex] = { ...hiddenCard, hidden: true, revealed: false };
  room.hiddenCommunityCardIndex = actualIndex;
  addLog(room, 'Signal Interference — one Flop card is hidden from the table.');
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

  if (room.gameMode === GAME_MODES.IMPOSTER) {
    const imposter = randomItem(room.players);
    room.imposterPlayerId = imposter?.id ?? null;
    room.challengeProgress = createChallengeProgress(room.challenges);
    room.publicSabotageHistory = [];
  } else {
    room.imposterPlayerId = null;
    room.challengeProgress = {};
    room.publicSabotageHistory = [];
    room.privateChallengeData = {};
  }

  dealPocketCards(room);
  room.guessPhase = null;

  if (hasChallenge(room, 'quickAccess')) {
    revealCommunity(room, 3);
    room.gameState = PHASES.FLOP;
  } else {
    room.gameState = PHASES.PRE_FLOP;
  }

  initChipPool(room);
  preparePrivateChallengeData(room);
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
    const revealedCards = revealCommunity(room, 3);
    if (hasChallenge(room, 'silentAlarm')) applySignalInterference(room, revealedCards);
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

export function getCrewPlayers(room) {
  if (!isImposterMode(room)) return room.players;
  return room.players.filter((player) => player.id !== room.imposterPlayerId);
}

export function getCrewHandOrder(room) {
  return [...getCrewPlayers(room)].sort((a, b) => {
    const handDifference = compareHands(
      evaluateBestHand(a.cards, room.communityCards),
      evaluateBestHand(b.cards, room.communityCards),
    );
    return handDifference || String(a.id).localeCompare(String(b.id));
  });
}

export function getIdealChipAssignment(room) {
  const orderedCrew = getCrewHandOrder(room);
  const assignment = {};

  orderedCrew.forEach((player, index) => {
    assignment[player.id] = index + 1;
  });

  if (isImposterMode(room) && room.imposterPlayerId) {
    assignment[room.imposterPlayerId] = room.players.length;
  }

  return assignment;
}

function getAssignmentEntries(room) {
  const assignment = getIdealChipAssignment(room);
  return room.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    chipValue: assignment[player.id] ?? null,
  }));
}

function getTruthfulPlacementClue(room) {
  const orderedCrew = getCrewHandOrder(room);
  const strongerPairs = [];

  for (let weakerIndex = 0; weakerIndex < orderedCrew.length; weakerIndex += 1) {
    for (let strongerIndex = weakerIndex + 1; strongerIndex < orderedCrew.length; strongerIndex += 1) {
      const weaker = orderedCrew[weakerIndex];
      const stronger = orderedCrew[strongerIndex];
      const weakerHand = evaluateBestHand(weaker.cards, room.communityCards);
      const strongerHand = evaluateBestHand(stronger.cards, room.communityCards);
      if (compareHands(strongerHand, weakerHand) > 0) {
        strongerPairs.push({ stronger, weaker });
      }
    }
  }

  const pair = randomItem(strongerPairs);
  if (pair) {
    return {
      type: 'RELATIONSHIP',
      strongerPlayerId: pair.stronger.id,
      strongerPlayerName: pair.stronger.name,
      weakerPlayerId: pair.weaker.id,
      weakerPlayerName: pair.weaker.name,
      text: `${pair.stronger.name} should rank above ${pair.weaker.name}.`,
    };
  }

  if (orderedCrew.length >= 2) {
    const first = orderedCrew[0];
    const second = orderedCrew[1];
    return {
      type: 'TIED_PLACEMENT',
      firstPlayerId: first.id,
      firstPlayerName: first.name,
      secondPlayerId: second.id,
      secondPlayerName: second.name,
      text: `${first.name} and ${second.name} are tied; neither should be ranked above the other.`,
    };
  }

  const strongest = orderedCrew[orderedCrew.length - 1];
  const topCount = Math.min(2, Math.max(1, orderedCrew.length));
  return {
    type: 'TOP_PLACEMENT',
    playerId: strongest?.id ?? null,
    playerName: strongest?.name ?? 'A player',
    topCount,
    text: `${strongest?.name ?? 'A player'} belongs in the top ${topCount}.`,
  };
}

function buildAllHands(room) {
  return getCrewPlayers(room).map((player) => ({
    playerId: player.id,
    playerName: player.name,
    cards: player.cards,
  }));
}

export function preparePrivateChallengeData(room) {
  room.privateChallengeData = {};
  if (!isImposterMode(room) || !room.imposterPlayerId) return;

  for (const player of room.players) {
    room.privateChallengeData[player.id] = {
      openBook: null,
      blueprint: null,
      falseTrail: null,
      targetOptions: [],
    };
  }

  const imposterData = room.privateChallengeData[room.imposterPlayerId];
  const imposterProgress = room.challengeProgress?.openBook;
  if (imposterProgress?.imposterLevel === 2 && hasChallenge(room, 'openBook')) {
    imposterData.openBook = {
      level: 2,
      hands: buildAllHands(room),
    };
  }

  const imposterBlueprint = room.challengeProgress?.blueprint;
  if (imposterBlueprint?.imposterLevel === 2 && hasChallenge(room, 'blueprint')) {
    imposterData.blueprint = {
      level: 2,
      ranking: getCrewHandOrder(room).map((player, index) => ({
        playerId: player.id,
        playerName: player.name,
        position: index + 1,
      })),
      assignment: getAssignmentEntries(room),
    };
  }

  const falseTrailProgress = room.challengeProgress?.falseTrail;
  if (falseTrailProgress?.imposterLevel > 0 && hasChallenge(room, 'falseTrail')) {
    imposterData.falseTrail = {
      level: falseTrailProgress.imposterLevel,
      used: falseTrailProgress.adviceUsed,
      maxUses: falseTrailProgress.imposterLevel,
    };
  }

  for (const crewPlayer of getCrewPlayers(room)) {
    const crewData = room.privateChallengeData[crewPlayer.id];
    const blueprintProgress = room.challengeProgress?.blueprint;
    if (blueprintProgress?.crewLevel === 1 && hasChallenge(room, 'blueprint')) {
      crewData.blueprint = {
        level: 1,
        clue: getTruthfulPlacementClue(room),
      };
    } else if (blueprintProgress?.crewLevel === 2 && hasChallenge(room, 'blueprint')) {
      crewData.blueprint = {
        level: 2,
        assignment: getAssignmentEntries(room),
      };
    }
  }

  const targetOptions = getCrewPlayers(room).map((player) => ({
    playerId: player.id,
    playerName: player.name,
  }));
  if (imposterProgress?.imposterLevel === 1 && hasChallenge(room, 'openBook')) {
    imposterData.targetOptions.push({ challengeId: 'openBook', players: targetOptions });
  }
  if (imposterBlueprint?.imposterLevel === 1 && hasChallenge(room, 'blueprint')) {
    imposterData.targetOptions.push({ challengeId: 'blueprint', players: targetOptions });
  }
}

export function getPrivateChallengeData(room, playerId) {
  return room.privateChallengeData?.[playerId] || {
    openBook: null,
    blueprint: null,
    falseTrail: null,
    targetOptions: [],
  };
}

export function getPlayerRole(room, playerId) {
  if (!isImposterMode(room) || room.gameState === PHASES.LOBBY) return null;
  return playerId === room.imposterPlayerId ? 'IMPOSTER' : 'CREW';
}

export function selectImposterTarget(room, playerId, challengeId, targetPlayerId) {
  if (!isImposterMode(room) || playerId !== room.imposterPlayerId) {
    return { error: 'Only the Imposter can select Intel targets' };
  }
  if (!canUseImposterAction(room)) {
    return { error: 'Intel target selection is unavailable in this phase' };
  }

  const progress = room.challengeProgress?.[challengeId];
  if (!progress || progress.imposterLevel !== 1) {
    return { error: 'This Intel target is not available' };
  }
  if (!['openBook', 'blueprint'].includes(challengeId) || !hasChallenge(room, challengeId)) {
    return { error: 'This Intel target is invalid' };
  }

  const target = getCrewPlayers(room).find((player) => player.id === targetPlayerId);
  if (!target) return { error: 'Intel target must be a Crew player' };

  const data = room.privateChallengeData[playerId];
  if (!data) return { error: 'Private Intel is not ready' };

  const existingSelection = challengeId === 'openBook' ? data.openBook : data.blueprint;
  if (existingSelection) {
    return { error: 'This Intel target has already been selected' };
  }

  if (challengeId === 'openBook') {
    data.openBook = {
      level: 1,
      target: {
        playerId: target.id,
        playerName: target.name,
        cards: target.cards,
      },
    };
  } else {
    const assignment = getIdealChipAssignment(room);
    const targetPosition = getCrewHandOrder(room).findIndex((player) => player.id === target.id) + 1;
    data.blueprint = {
      level: 1,
      target: {
        playerId: target.id,
        playerName: target.name,
        position: targetPosition,
        idealChipValue: assignment[target.id] ?? null,
      },
    };
  }

  data.targetOptions = data.targetOptions.filter((entry) => entry.challengeId !== challengeId);
  return { ok: true, data: getPrivateChallengeData(room, playerId) };
}

export function submitImposterAdvice(room, playerId, targetPlayerId, adviceId) {
  if (!isImposterMode(room) || playerId !== room.imposterPlayerId) {
    return { error: 'Only the Imposter can send False Trail advice' };
  }
  if (!canUseImposterAction(room)) {
    return { error: 'False Trail advice is unavailable in this phase' };
  }
  if (!hasChallenge(room, 'falseTrail')) {
    return { error: 'False Trail is not active' };
  }

  const progress = room.challengeProgress?.falseTrail;
  const advice = IMPOSTER_ADVICE_DEFS.find((item) => item.id === adviceId);
  const target = getCrewPlayers(room).find((player) => player.id === targetPlayerId);
  const maxUses = Math.max(0, progress?.imposterLevel || 0);
  const decisionKey = `${room.heistNumber}:${room.gameState}:${room.currentChipColor || 'none'}`;

  if (!progress || !advice || !target) {
    return { error: 'False Trail advice is invalid' };
  }
  if (progress.adviceUsed >= maxUses) {
    return { error: 'No False Trail advice remains' };
  }
  if (progress.adviceDecisionKeys.includes(decisionKey)) {
    return { error: 'False Trail advice must target separate decisions' };
  }

  progress.adviceUsed += 1;
  progress.adviceDecisionKeys.push(decisionKey);
  const privateData = room.privateChallengeData?.[playerId];
  if (privateData?.falseTrail) {
    privateData.falseTrail.used = progress.adviceUsed;
  }
  const publicClue = progress.crewLevel >= 2
    ? {
      category: 'communication',
      affectedPhase: room.gameState,
      decisionType: room.currentChipColor || 'showdown',
    }
    : progress.crewLevel === 1
      ? { category: 'communication' }
      : null;

  room.publicSabotageHistory.push({
    time: Date.now(),
    category: 'communication',
  });

  return {
    ok: true,
    targetId: target.id,
    advice: {
      id: advice.id,
      label: advice.label,
      fromName: room.players.find((player) => player.id === playerId)?.name || 'Player',
    },
    publicClue,
  };
}

export function getCrewRankingSuccess(room) {
  const orderedCrew = [...getCrewPlayers(room)].sort((a, b) => {
    const chipA = a.chips.red ?? Number.POSITIVE_INFINITY;
    const chipB = b.chips.red ?? Number.POSITIVE_INFINITY;
    return chipA - chipB || String(a.id).localeCompare(String(b.id));
  });

  for (let index = 1; index < orderedCrew.length; index += 1) {
    const previous = evaluateBestHand(orderedCrew[index - 1].cards, room.communityCards);
    const current = evaluateBestHand(orderedCrew[index].cards, room.communityCards);
    if (compareHands(current, previous) < 0) return false;
  }

  return true;
}

function cardKey(card) {
  return `${card.rank}_${card.suit}`;
}

function combinations(cards, count) {
  if (count === 0) return [[]];
  if (cards.length < count) return [];

  const [first, ...rest] = cards;
  const withFirst = combinations(rest, count - 1).map((combo) => [first, ...combo]);
  const withoutFirst = combinations(rest, count);
  return [...withFirst, ...withoutFirst];
}

function canPlaceHand(hand, previousHand, nextHand) {
  if (previousHand && compareHands(hand, previousHand) < 0) return false;
  if (nextHand && compareHands(nextHand, hand) < 0) return false;
  return true;
}

function generatePublicShowdownHand(room) {
  const imposter = room.players.find((player) => player.id === room.imposterPlayerId);
  if (!imposter) return;

  const visibleCards = [
    ...room.communityCards,
    ...room.players.flatMap((player) => player.cards || []),
  ];
  const usedKeys = new Set(visibleCards.map(cardKey));
  const candidateCards = createDeck().filter((card) => !usedKeys.has(cardKey(card)));
  const cardCount = imposter.cards.length;
  const orderedPlayers = [...room.players].sort((a, b) => {
    const chipA = a.chips.red ?? Number.POSITIVE_INFINITY;
    const chipB = b.chips.red ?? Number.POSITIVE_INFINITY;
    return chipA - chipB || String(a.id).localeCompare(String(b.id));
  });
  const imposterIndex = orderedPlayers.findIndex((player) => player.id === imposter.id);
  const previousCrew = orderedPlayers
    .slice(0, imposterIndex)
    .reverse()
    .find((player) => player.id !== imposter.id);
  const nextCrew = orderedPlayers
    .slice(imposterIndex + 1)
    .find((player) => player.id !== imposter.id);
  const previousHand = previousCrew
    ? evaluateBestHand(previousCrew.cards, room.communityCards)
    : null;
  const nextHand = nextCrew
    ? evaluateBestHand(nextCrew.cards, room.communityCards)
    : null;

  const validCandidates = combinations(candidateCards, cardCount).filter((cards) => {
    const hand = evaluateBestHand(cards, room.communityCards);
    return canPlaceHand(hand, previousHand, nextHand);
  });

  const fallbackCandidates = combinations(candidateCards, cardCount);
  imposter.publicShowdownCards = randomItem(validCandidates) || randomItem(fallbackCandidates) || [];
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
  if (isImposterMode(room)) {
    generatePublicShowdownHand(room);
  }

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

export function getShowdownStep(room, viewerId = null) {
  if (room.gameState === PHASES.SHOWDOWN_GUESS) {
    return { needsGuess: true, guessPhase: sanitizeGuessPhase(room, room.lastViewerId) };
  }

  if (room.gameState !== PHASES.SHOWDOWN) return null;
  if (room.showdownIndex >= room.showdownOrder.length) {
    return { done: true };
  }

  const playerId = room.showdownOrder[room.showdownIndex];
  const player = room.players.find((p) => p.id === playerId);
  const cards = isImposterMode(room)
    && player.id === room.imposterPlayerId
    && viewerId !== room.imposterPlayerId
    ? player.publicShowdownCards
    : player.cards;
  const hand = evaluateBestHand(cards, room.communityCards);
  const isLast = room.showdownIndex === room.showdownOrder.length - 1;

  return {
    playerId,
    playerName: player.name,
    cards,
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
  const imposterMode = isImposterMode(room);
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
  if (!imposterMode && room.showdownIndex > 0) {
    const prevId = room.showdownOrder[room.showdownIndex - 1];
    const prevPlayer = room.players.find((p) => p.id === prevId);
    const prevHand = evaluateBestHand(prevPlayer.cards, room.communityCards);
    if (compareHands(hand, prevHand) < 0) {
      valid = false;
    }
  }

  room.showdownIndex++;
  const isLast = room.showdownIndex >= room.showdownOrder.length;

  if (imposterMode && isLast) {
    valid = getCrewRankingSuccess(room);
  }

  if (isLast && !valid) return finishShowdown(room, false);
  if (isLast && valid) return finishShowdown(room, true);
  if (!valid) return finishShowdown(room, false);

  return { ok: true, step, continue: true };
}

export function buildLeaderboard(room) {
  const entries = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    chipValue: p.chips.red ?? null,
    hand: isImposterMode(room) && p.id === room.imposterPlayerId
      ? evaluateBestHand(p.publicShowdownCards || [], room.communityCards)
      : evaluateBestHand(p.cards, room.communityCards),
  }));

  const handOrder = [...entries].sort((a, b) => {
    const handDifference = compareHands(b.hand, a.hand);
    if (handDifference !== 0) return handDifference;
    return String(a.id).localeCompare(String(b.id));
  });
  const handPlacements = new Map();
  const handTieCounts = new Map();
  for (const entry of entries) {
    handTieCounts.set(
      entry.id,
      entries.filter((other) => compareHands(entry.hand, other.hand) === 0).length,
    );
  }

  let handPlacement = 0;
  for (let index = 0; index < handOrder.length; index += 1) {
    if (index === 0 || compareHands(handOrder[index].hand, handOrder[index - 1].hand) !== 0) {
      handPlacement = index + 1;
    }
    handPlacements.set(handOrder[index].id, handPlacement);
  }

  return entries
    .sort((a, b) => {
      const chipA = a.chipValue ?? Number.POSITIVE_INFINITY;
      const chipB = b.chipValue ?? Number.POSITIVE_INFINITY;
      if (chipA !== chipB) return chipA - chipB;
      const handDifference = compareHands(b.hand, a.hand);
      if (handDifference !== 0) return handDifference;
      return String(a.id).localeCompare(String(b.id));
    })
    .map((entry, index) => ({
      ...entry,
      placement: index + 1,
      handPlacement: handPlacements.get(entry.id) ?? index + 1,
      tied: (handTieCounts.get(entry.id) ?? 1) > 1,
    }));
}

function finishShowdown(room, success) {
  if (hasChallenge(room, 'silentAlarm') && room.hiddenCommunityCardIndex != null && room.communityCards[room.hiddenCommunityCardIndex]) {
    room.communityCards[room.hiddenCommunityCardIndex] = {
      ...room.communityCards[room.hiddenCommunityCardIndex],
      hidden: false,
      revealed: true,
    };
  }

  room.guessPhase = null;
  room.leaderboard = buildLeaderboard(room);

  if (success) {
    room.vault++;
    room.lastHeistSuccess = true;
    addLog(room, `Heist #${room.heistNumber} THÀNH CÔNG! (${room.vault}/3)`);
  } else {
    room.alarms++;
    room.lastHeistSuccess = false;
    addLog(room, `Heist #${room.heistNumber} THẤT BẠI! (${room.alarms}/3)`);
  }

  incrementChallengeProgress(room, success);

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
  resetChallengeUses(room);
  preparePrivateChallengeData(room);
  room.showdownOrder = [];
  room.showdownIndex = 0;
  addLog(room, `Heist #${room.heistNumber} bắt đầu!`);
  return { ok: true };
}

export function returnToLobby(room) {
  if (![PHASES.HEIST_RESULT, PHASES.GAME_OVER].includes(room.gameState)) {
    return { error: 'Cannot return to lobby during this phase' };
  }

  for (const player of room.players) {
    player.cards = [];
    player.publicShowdownCards = [];
    player.chips = {};
  }

  room.gameState = PHASES.LOBBY;
  room.deck = [];
  room.communityCards = [];
  room.currentChipColor = null;
  room.availableChips = [];
  room.lockedChips = new Set();
  room.roundSelections = {};
  room.roundConfirmed = {};
  room.tradeOffer = null;
  room.showdownOrder = [];
  room.showdownIndex = 0;
  room.lastHeistSuccess = null;
  room.leaderboard = [];
  room.guessPhase = null;
  room.hiddenCommunityCardIndex = null;
  room.vault = 0;
  room.alarms = 0;
  room.heistNumber = 1;
  room.gameLog = [];
  room.imposterPlayerId = null;
  room.challengeProgress = {};
  room.publicSabotageHistory = [];
  room.privateChallengeData = {};

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

  if (hasChallenge(room, 'noiseSensor') && selected === 1) {
    return { error: 'Chip 1 sao đã tự động khóa và không thể trả về trung tâm.' };
  }

  delete room.roundSelections[playerId];
  if (!room.availableChips.includes(selected)) {
    room.availableChips.push(selected);
    room.availableChips.sort((a, b) => a - b);
  }

  room.roundConfirmed[playerId] = false;
  return { ok: true, returned: true, chipValue: selected };
}

export function confirmChipSelection(room, playerId, chipValue = null) {
  const color = room.currentChipColor;
  if (!color) return { error: 'Không có chip round này' };
  if (room.roundSelections[playerId] == null && chipValue != null) {
    const selection = selectChip(room, playerId, chipValue);
    if (selection.error) return selection;
  }

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
  const normalizedChipValue = Number(chipValue);
  if (!Number.isInteger(normalizedChipValue)) {
    return { error: 'Chip value is invalid' };
  }

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
  if (!available.includes(normalizedChipValue)) {
    return { error: 'Chip không còn trong pool' };
  }

  const previous = room.roundSelections[playerId];
  if (previous != null && previous !== normalizedChipValue) {
    room.availableChips.push(previous);
    room.availableChips.sort((a, b) => a - b);
  }

  room.roundSelections[playerId] = normalizedChipValue;
  room.availableChips = room.availableChips.filter((c) => c !== normalizedChipValue);
  room.roundConfirmed[playerId] = false;

  if (hasChallenge(room, 'noiseSensor') && normalizedChipValue === 1) {
    room.roundConfirmed[playerId] = true;
    room.lockedChips.add(normalizedChipValue);
    addLog(room, `${player.name} chọn chip 1 sao — Noise Sensor tự động khóa và xác nhận.`);
  }

  if (shouldLockChip(room, normalizedChipValue)) {
    room.lockedChips.add(normalizedChipValue);
    const reason = normalizedChipValue === 1 ? 'Noise Sensor' : 'Ventilation Shaft';
    addLog(room, `Chip ${normalizedChipValue} bị khóa (${reason})`);
  }

  addLog(room, `${player.name} chọn chip ${normalizedChipValue}`);

  const ready = allPlayersConfirmed(room);
  return { ok: true, allReady: ready, selectedChip: normalizedChipValue };
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
    gameMode: room.gameMode,
    revealedImposterId: room.gameState === PHASES.GAME_OVER ? room.imposterPlayerId : null,
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
    publicSabotageHistory: room.publicSabotageHistory || [],
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
  const isPublicImposterHand = isImposterMode(room)
    && player.id === room.imposterPlayerId
    && player.id !== viewerId
    && [PHASES.SHOWDOWN, PHASES.GAME_OVER].includes(room.gameState);

  if (
    room.gameState === PHASES.SHOWDOWN &&
    room.showdownOrder.slice(0, room.showdownIndex).includes(player.id)
  ) {
    return isPublicImposterHand ? player.publicShowdownCards : player.cards;
  }
  if (player.id === viewerId || room.gameState === PHASES.GAME_OVER) {
    return isPublicImposterHand ? player.publicShowdownCards : player.cards;
  }
  return null;
}

export function getPlayerCards(room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  return player ? player.cards : [];
}

export { CHIP_COLORS, allPlayersHaveChip };
