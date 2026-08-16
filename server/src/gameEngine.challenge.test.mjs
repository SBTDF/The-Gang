import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, PHASES, submitGuess } from './gameEngine.js';

function makeRoomWithGuessPhase() {
  const room = createRoom('host', 'Host', 3);
  room.players.push(
    { id: 'p2', name: 'B', cards: [{ rank: 'A', suit: 'H' }, { rank: 'K', suit: 'D' }], chips: { red: 2 }, connected: true },
    { id: 'p3', name: 'C', cards: [{ rank: 'Q', suit: 'S' }, { rank: 'J', suit: 'C' }], chips: { red: 3 }, connected: true },
  );
  room.gameState = PHASES.SHOWDOWN_GUESS;
  room.guessPhase = {
    targetPlayerId: 'host',
    targetName: 'Host',
    needRetina: true,
    needFingerprint: false,
    votes: {},
    confirmed: false,
    retinaGuess: null,
    fingerprintGuess: null,
    startedAt: Date.now(),
    expiresAt: Date.now() + 30000,
  };
  return room;
}

test('submitGuess saves a draft pick before confirmation and locks it after confirm', () => {
  const room = makeRoomWithGuessPhase();

  const draft = submitGuess(room, 'p2', { cardRank: 'A', confirm: false });
  assert.equal(draft.ok, true);
  assert.equal(room.guessPhase.votes['p2'].cardRank, 'A');
  assert.equal(room.guessPhase.votes['p2'].confirmed, false);

  const confirm = submitGuess(room, 'p2', { cardRank: 'K', confirm: true });
  assert.equal(confirm.ok, true);
  assert.equal(room.guessPhase.votes['p2'].cardRank, 'K');
  assert.equal(room.guessPhase.votes['p2'].confirmed, true);
});
