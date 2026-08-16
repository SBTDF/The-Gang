const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

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

function rankValue(rank) {
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return Number(rank);
}

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
  const isFlush = suits.every((suit) => suit === suits[0]);

  let isStraight = false;
  let straightHigh = values[0];
  const unique = [...new Set(values)].sort((a, b) => b - a);

  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true;
      straightHigh = unique[0];
    } else if (unique.includes(14) && [5, 4, 3, 2].every((v) => unique.includes(v))) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] || 0) + 1;
  }

  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

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
      combo: cards,
    };
  }

  if (groups[0].count === 4) {
    const quad = groups[0].value;
    const kicker = groups[1]?.value ?? 0;
    return { rank: 7, name: 'Four of a Kind', tiebreak: [quad, kicker], combo: cards };
  }

  if (groups[0].count === 3 && groups[1]?.count === 2) {
    return {
      rank: 6,
      name: 'Full House',
      tiebreak: [groups[0].value, groups[1].value],
      combo: cards,
    };
  }

  if (isFlush) {
    return { rank: 5, name: 'Flush', tiebreak: values, combo: cards };
  }

  if (isStraight) {
    return { rank: 4, name: 'Straight', tiebreak: [straightHigh], combo: cards };
  }

  if (groups[0].count === 3) {
    const trips = groups[0].value;
    const rest = groups.slice(1).flatMap((group) => Array(group.count).fill(group.value));
    return { rank: 3, name: 'Three of a Kind', tiebreak: [trips, ...rest], combo: cards };
  }

  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const highPair = Math.max(groups[0].value, groups[1].value);
    const lowPair = Math.min(groups[0].value, groups[1].value);
    const kicker = groups[2]?.value ?? 0;
    return { rank: 2, name: 'Two Pair', tiebreak: [highPair, lowPair, kicker], combo: cards };
  }

  if (groups[0].count === 2) {
    const pair = groups[0].value;
    const rest = groups.slice(1).flatMap((group) => Array(group.count).fill(group.value));
    return { rank: 1, name: 'Pair', tiebreak: [pair, ...rest], combo: cards };
  }

  return { rank: 0, name: 'High Card', tiebreak: values, combo: cards };
}

export function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i += 1) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function evaluateBestHand(pocketCards, communityCards) {
  const allCards = [...pocketCards, ...communityCards];
  if (allCards.length < 5) {
    return {
      rank: -1,
      name: 'Incomplete',
      tiebreak: [],
      combo: allCards.slice(0, 5),
    };
  }

  let best = null;
  for (const combo of combinations(allCards, 5)) {
    const result = evaluate5(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }

  return best ?? { rank: -1, name: 'Incomplete', tiebreak: [], combo: allCards.slice(0, 5) };
}

export function formatCardLabel(card) {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export { HAND_NAMES };
