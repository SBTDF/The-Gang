import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advancePhase,
  buildLeaderboard,
  confirmChipSelection,
  createRoom,
  PHASES,
  requestTrade,
  returnChipToCenter,
  returnToLobby,
  selectChip,
  startGame,
} from './gameEngine.js';

function makeRound() {
  const room = createRoom('host', 'Host', 3);
  room.players.push(
    { id: 'p2', name: 'P2', cards: [], chips: {}, connected: true },
    { id: 'p3', name: 'P3', cards: [], chips: {}, connected: true },
  );
  room.gameState = PHASES.PRE_FLOP;
  room.currentChipColor = 'white';
  room.availableChips = [1, 2, 3];
  room.roundSelections = {};
  room.roundConfirmed = {};
  return room;
}

function makeGameRoom(challenges = []) {
  const room = makeRound();
  room.gameState = PHASES.LOBBY;
  room.currentChipColor = null;
  room.availableChips = [];
  room.challenges = challenges;
  assert.equal(startGame(room).ok, true);
  return room;
}

function commitRound(room) {
  for (const [playerId, chipValue] of [['host', 1], ['p2', 2], ['p3', 3]]) {
    assert.equal(selectChip(room, playerId, chipValue).ok, true);
  }
  for (const playerId of ['host', 'p2', 'p3']) {
    assert.equal(confirmChipSelection(room, playerId).ok, true);
  }
}

test('chip round requires per-player confirmation before phase advance', () => {
  const room = makeRound();
  selectChip(room, 'host', 2);
  assert.equal(room.roundSelections.host, 2);
  assert.equal(room.roundConfirmed.host, false);

  confirmChipSelection(room, 'host');
  assert.equal(room.roundConfirmed.host, true);
});

test('trade requests are recorded and expire', () => {
  const room = makeRound();
  room.roundSelections.host = 2;
  room.roundSelections.p2 = 3;
  const offer = requestTrade(room, 'host', 'p2', 2, 3);
  assert.equal(offer.ok, true);
  assert.equal(room.tradeOffer.fromPlayerId, 'host');
  assert.equal(room.tradeOffer.toPlayerId, 'p2');
});

test('returning a selected chip to the center clears the draft without confirming it', () => {
  const room = makeRound();
  room.availableChips = [1, 2, 3];
  room.roundSelections.host = 2;

  const result = returnChipToCenter(room, 'host');
  assert.equal(result.ok, true);
  assert.equal(room.roundSelections.host, undefined);
  assert.deepEqual(room.availableChips, [1, 2, 3]);
});

test('confirmation can authoritatively record a chip included in the confirm request', () => {
  const room = makeRound();

  const result = confirmChipSelection(room, 'host', 2);

  assert.equal(result.ok, true);
  assert.equal(room.roundSelections.host, 2);
  assert.equal(room.roundConfirmed.host, true);
});

test('Hasty Getaway skips the orange round and reaches showdown', () => {
  const room = makeGameRoom(['hastyGetaway']);

  commitRound(room);
  assert.equal(advancePhase(room).ok, true);
  assert.equal(room.gameState, PHASES.FLOP);

  commitRound(room);
  const hastyAdvance = advancePhase(room);
  assert.equal(hastyAdvance.ok, true);
  assert.equal(room.gameState, PHASES.RIVER);
  assert.equal(room.currentChipColor, 'red');
  assert.equal(room.communityCards.length, 5);

  commitRound(room);
  const showdownAdvance = advancePhase(room);
  assert.equal(showdownAdvance.showdown, true);
  assert.equal(room.gameState, PHASES.SHOWDOWN);
});

test('normal chip rounds still transition through Flop, Turn, River, and Showdown', () => {
  const room = makeGameRoom();

  commitRound(room);
  advancePhase(room);
  assert.equal(room.gameState, PHASES.FLOP);
  commitRound(room);
  advancePhase(room);
  assert.equal(room.gameState, PHASES.TURN);
  commitRound(room);
  advancePhase(room);
  assert.equal(room.gameState, PHASES.RIVER);
  commitRound(room);
  advancePhase(room);
  assert.equal(room.gameState, PHASES.SHOWDOWN);
  assert.equal(room.communityCards.length, 5);
});

test('returning to the lobby resets the game while preserving challenges for the next start', () => {
  const room = makeGameRoom(['hastyGetaway']);
  room.gameState = PHASES.GAME_OVER;
  room.vault = 3;
  room.leaderboard = [{ id: 'host' }];

  const result = returnToLobby(room);

  assert.equal(result.ok, true);
  assert.equal(room.gameState, PHASES.LOBBY);
  assert.deepEqual(room.challenges, ['hastyGetaway']);
  assert.equal(room.vault, 0);
  assert.equal(room.alarms, 0);
  assert.deepEqual(room.leaderboard, []);
  assert.equal(startGame(room).ok, true);
});

test('final leaderboard follows red-chip order and marks identical hands as tied', () => {
  const room = makeRound();
  room.communityCards = [
    { rank: '3', suit: 'diamonds' },
    { rank: '3', suit: 'hearts' },
    { rank: 'A', suit: 'clubs' },
    { rank: '5', suit: 'diamonds' },
    { rank: '5', suit: 'clubs' },
  ];
  room.players[0].chips = { red: 3 };
  room.players[0].cards = [{ rank: '2', suit: 'spades' }, { rank: '9', suit: 'hearts' }];
  room.players[1].chips = { red: 1 };
  room.players[1].cards = [{ rank: '4', suit: 'spades' }, { rank: '8', suit: 'hearts' }];
  room.players[2].chips = { red: 2 };
  room.players[2].cards = [{ rank: '6', suit: 'spades' }, { rank: '7', suit: 'hearts' }];

  const leaderboard = buildLeaderboard(room);

  assert.deepEqual(leaderboard.map((entry) => entry.id), ['p2', 'p3', 'host']);
  assert.deepEqual(leaderboard.map((entry) => entry.chipValue), [1, 2, 3]);
  assert.deepEqual(leaderboard.map((entry) => entry.handPlacement), [1, 1, 1]);
  assert.deepEqual(leaderboard.map((entry) => entry.tied), [true, true, true]);
});
