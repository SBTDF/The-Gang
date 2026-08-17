import test from 'node:test';
import assert from 'node:assert/strict';

import { compareHands, evaluateBestHand } from './handEvaluator.js';

const card = (rank, suit) => ({ rank, suit });

test('players with the same best five-card hand compare as a true tie', () => {
  const community = [
    card('3', 'diamonds'),
    card('3', 'hearts'),
    card('A', 'clubs'),
    card('5', 'diamonds'),
    card('5', 'clubs'),
  ];
  const first = evaluateBestHand([card('2', 'spades'), card('9', 'hearts')], community);
  const second = evaluateBestHand([card('4', 'spades'), card('8', 'hearts')], community);

  assert.equal(first.name, 'Two Pair');
  assert.equal(second.name, 'Two Pair');
  assert.deepEqual(first.tiebreak, second.tiebreak);
  assert.equal(compareHands(first, second), 0);
});

test('same category hands use kickers as a deterministic tiebreaker', () => {
  const community = [
    card('A', 'hearts'),
    card('A', 'diamonds'),
    card('7', 'clubs'),
    card('4', 'spades'),
    card('2', 'hearts'),
  ];
  const kingKicker = evaluateBestHand([card('K', 'clubs'), card('9', 'diamonds')], community);
  const queenKicker = evaluateBestHand([card('Q', 'clubs'), card('9', 'spades')], community);

  assert.equal(kingKicker.name, 'Pair');
  assert.equal(queenKicker.name, 'Pair');
  assert.equal(compareHands(kingKicker, queenKicker) > 0, true);
});

test('best-five selection handles trips and two-pair kicker differences', () => {
  const tripsBoard = [
    card('7', 'hearts'),
    card('7', 'diamonds'),
    card('7', 'clubs'),
    card('2', 'spades'),
    card('3', 'hearts'),
  ];
  const tripsWithAce = evaluateBestHand([card('A', 'clubs'), card('K', 'diamonds')], tripsBoard);
  const tripsWithQueen = evaluateBestHand([card('Q', 'clubs'), card('J', 'diamonds')], tripsBoard);
  assert.equal(tripsWithAce.name, 'Three of a Kind');
  assert.equal(compareHands(tripsWithAce, tripsWithQueen) > 0, true);

  const twoPairBoard = [
    card('10', 'hearts'),
    card('10', 'diamonds'),
    card('4', 'clubs'),
    card('4', 'spades'),
    card('2', 'hearts'),
  ];
  const aceKicker = evaluateBestHand([card('A', 'clubs'), card('K', 'diamonds')], twoPairBoard);
  const queenKicker = evaluateBestHand([card('Q', 'clubs'), card('J', 'diamonds')], twoPairBoard);
  assert.equal(aceKicker.name, 'Two Pair');
  assert.equal(compareHands(aceKicker, queenKicker) > 0, true);
});

test('a genuinely stronger best five-card hand outranks the shared community hand', () => {
  const community = [
    card('3', 'diamonds'),
    card('3', 'hearts'),
    card('A', 'clubs'),
    card('5', 'diamonds'),
    card('5', 'clubs'),
  ];
  const trips = evaluateBestHand([card('3', 'spades'), card('9', 'hearts')], community);
  const communityTwoPair = evaluateBestHand([card('2', 'spades'), card('9', 'hearts')], community);

  assert.equal(compareHands(trips, communityTwoPair) > 0, true);
});
