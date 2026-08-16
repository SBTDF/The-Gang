import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, PHASES, selectChip, confirmChipSelection, requestTrade, returnChipToCenter } from './gameEngine.js';

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
