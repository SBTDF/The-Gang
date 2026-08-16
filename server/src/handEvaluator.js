import { rankValue } from './deck.js';

const HAND_NAMES = [
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

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluate5(cards) {
  const values = cards.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  let isStraight = false;
  let straightHigh = values[0];
  const unique = [...new Set(values)].sort((a, b) => b - a);

  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true;
      straightHigh = unique[0];
    } else if (
      unique.join(',') === '14,5,4,3,2' ||
      unique.join(',') === '14,2,3,4,5'
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ value: +v, count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const kickers = groups
    .sort((a, b) => b.count - a.count || b.value - a.value)
    .flatMap((g) => Array(g.count).fill(g.value));

  if (isFlush && isStraight) {
    const isRoyal =
      straightHigh === 14 &&
      unique.includes(13) &&
      unique.includes(12) &&
      unique.includes(11) &&
      unique.includes(10);
    return {
      rank: isRoyal ? 9 : 8,
      name: isRoyal ? 'Royal Flush' : 'Straight Flush',
      tiebreak: [straightHigh],
    };
  }

  if (groups[0].count === 4) {
    const quad = groups[0].value;
    const kicker = groups[1].value;
    return { rank: 7, name: 'Four of a Kind', tiebreak: [quad, kicker] };
  }

  if (groups[0].count === 3 && groups[1]?.count === 2) {
    return {
      rank: 6,
      name: 'Full House',
      tiebreak: [groups[0].value, groups[1].value],
    };
  }

  if (isFlush) {
    return { rank: 5, name: 'Flush', tiebreak: values };
  }

  if (isStraight) {
    return { rank: 4, name: 'Straight', tiebreak: [straightHigh] };
  }

  if (groups[0].count === 3) {
    const trips = groups[0].value;
    const rest = groups.slice(1).flatMap((g) => Array(g.count).fill(g.value));
    return { rank: 3, name: 'Three of a Kind', tiebreak: [trips, ...rest] };
  }

  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const highPair = Math.max(groups[0].value, groups[1].value);
    const lowPair = Math.min(groups[0].value, groups[1].value);
    const kicker = groups[2]?.value ?? 0;
    return { rank: 2, name: 'Two Pair', tiebreak: [highPair, lowPair, kicker] };
  }

  if (groups[0].count === 2) {
    const pair = groups[0].value;
    const rest = groups.slice(1).flatMap((g) => Array(g.count).fill(g.value));
    return { rank: 1, name: 'Pair', tiebreak: [pair, ...rest] };
  }

  return { rank: 0, name: 'High Card', tiebreak: values };
}

export function evaluateBestHand(pocketCards, communityCards) {
  const all = [...pocketCards, ...communityCards];
  if (all.length < 5) {
    return { rank: -1, name: 'Incomplete', tiebreak: [] };
  }

  let best = null;
  for (const combo of combinations(all, 5)) {
    const result = evaluate5(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }
  return best;
}

export function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export { HAND_NAMES };
