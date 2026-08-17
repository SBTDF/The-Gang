import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, PHASES, submitGuess } from './gameEngine.js';
import { evaluateBestHand } from './handEvaluator.js';

function makeRoomWithGuessPhase(challenges = ['retinaScan']) {
  const room = createRoom('host', 'Host', 3);
  room.players[0].cards = [{ rank: '10', suit: 'hearts' }, { rank: '2', suit: 'clubs' }];
  room.players.push(
    { id: 'p2', name: 'B', cards: [{ rank: 'A', suit: 'H' }, { rank: 'K', suit: 'D' }], chips: { red: 2 }, connected: true },
    { id: 'p3', name: 'C', cards: [{ rank: 'Q', suit: 'S' }, { rank: 'J', suit: 'C' }], chips: { red: 3 }, connected: true },
  );
  room.challenges = challenges;
  room.gameState = PHASES.SHOWDOWN_GUESS;
  room.guessPhase = {
    targetPlayerId: 'host',
    targetName: 'Host',
    needRetina: challenges.includes('retinaScan'),
    needFingerprint: challenges.includes('fingerprintScan'),
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

test('Retina Scan and Fingerprint Scan work independently and together', () => {
  for (const challenges of [['retinaScan'], ['fingerprintScan'], ['retinaScan', 'fingerprintScan']]) {
    const room = makeRoomWithGuessPhase(challenges);
    const target = room.players.find((player) => player.id === 'host');
    const targetHand = evaluateBestHand(target.cards, room.communityCards);

    assert.equal(room.guessPhase.needRetina, challenges.includes('retinaScan'));
    assert.equal(room.guessPhase.needFingerprint, challenges.includes('fingerprintScan'));

    const guess = {
      cardRank: challenges.includes('retinaScan') ? target.cards[0].rank : null,
      handRank: challenges.includes('fingerprintScan') ? targetHand.name : null,
      confirm: true,
    };
    assert.equal(submitGuess(room, 'p2', guess).waiting, true);
    const finalVote = submitGuess(room, 'p3', guess);
    assert.equal(finalVote.guessConfirmed, true);
    assert.equal(room.gameState, PHASES.SHOWDOWN);
    assert.equal(room.guessPhase.needRetina, challenges.includes('retinaScan'));
    assert.equal(room.guessPhase.needFingerprint, challenges.includes('fingerprintScan'));
  }
});
