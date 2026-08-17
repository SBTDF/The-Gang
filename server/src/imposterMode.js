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
    desc: 'The Imposter gains private Crew-hand intel while the Crew gets an early look at the community board.',
    imposterBuff: 'Crew Hand Recon',
    crewBuff: 'Community Forecast',
  },
  {
    id: 'blueprint',
    num: 2,
    name: 'Blueprint',
    desc: 'The Imposter gains private placement intel while the Crew gets limited decision-recovery uses.',
    imposterBuff: 'Position Blueprint',
    crewBuff: 'Reroute',
  },
  {
    id: 'falseTrail',
    num: 3,
    name: 'False Trail',
    desc: 'The Imposter can send legal private decoys while the Crew gains limited peer-verification uses.',
    imposterBuff: 'Legal Decoy Suggestion',
    crewBuff: 'Crew Verification',
  },
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
        imposterLevel: 1,
        crewLevel: 1,
        adviceUsed: 0,
        adviceDecisionKeys: [],
        rerouteUsed: 0,
        verificationUsed: 0,
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
    progress.rerouteUsed = 0;
    progress.verificationUsed = 0;
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
