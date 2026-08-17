import { randomInt } from 'node:crypto';

export const GAME_MODES = {
  CLASSIC: 'CLASSIC',
  IMPOSTER: 'IMPOSTER',
};

export const IMPOSTER_CHALLENGE_DEFS = [
  {
    id: 'openBook',
    num: 1,
    name: 'Open Book',
    desc: 'The winning side gains increasingly powerful private hand information for the next heist.',
  },
  {
    id: 'blueprint',
    num: 2,
    name: 'Blueprint',
    desc: 'The winning side gains increasingly powerful private ranking and chip-placement information for the next heist.',
  },
  {
    id: 'falseTrail',
    num: 3,
    name: 'False Trail',
    desc: 'The Imposter can privately send misleading recommendations, while the Crew receives truthful sabotage evidence after failures.',
  },
];

export const IMPOSTER_ADVICE_DEFS = [
  { id: 'higher', label: 'Recommend higher' },
  { id: 'lower', label: 'Recommend lower' },
  { id: 'agree', label: 'Recommend this position' },
  { id: 'swap', label: 'Recommend a swap' },
];

export function isImposterMode(room) {
  return room?.gameMode === GAME_MODES.IMPOSTER;
}

export function isSupportedGameMode(gameMode) {
  return gameMode === GAME_MODES.CLASSIC || gameMode === GAME_MODES.IMPOSTER;
}

export function isImposterChallenge(id) {
  return IMPOSTER_CHALLENGE_DEFS.some((challenge) => challenge.id === id);
}

export function getImposterChallengeDefinition(id) {
  return IMPOSTER_CHALLENGE_DEFS.find((challenge) => challenge.id === id) || null;
}

export function createChallengeProgress(challengeIds = []) {
  return Object.fromEntries(
    challengeIds
      .filter(isImposterChallenge)
      .map((id) => [id, {
        imposterLevel: 0,
        crewLevel: 0,
        adviceUsed: 0,
        adviceDecisionKeys: [],
      }]),
  );
}

export function incrementChallengeProgress(room, success) {
  if (!isImposterMode(room)) return;

  for (const challengeId of room.challenges) {
    const progress = room.challengeProgress?.[challengeId];
    if (!progress) continue;

    const levelKey = success ? 'imposterLevel' : 'crewLevel';
    progress[levelKey] = Math.min(2, progress[levelKey] + 1);
  }
}

export function resetChallengeUses(room) {
  if (!room.challengeProgress) return;

  for (const progress of Object.values(room.challengeProgress)) {
    progress.adviceUsed = 0;
    progress.adviceDecisionKeys = [];
  }
}

export function randomIndex(length) {
  if (!Number.isInteger(length) || length <= 0) return -1;
  return randomInt(length);
}

export function randomItem(items) {
  const index = randomIndex(items.length);
  return index < 0 ? null : items[index];
}
