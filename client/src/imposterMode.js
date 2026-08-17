export const GAME_MODES = {
  CLASSIC: 'CLASSIC',
  IMPOSTER: 'IMPOSTER',
};

export const IMPOSTER_CHALLENGES = [
  {
    id: 'openBook',
    name: 'Open Book',
    desc: 'The winning side gains increasingly powerful private hand information for the next heist.',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    desc: 'The winning side gains increasingly powerful private ranking and chip-placement information for the next heist.',
  },
  {
    id: 'falseTrail',
    name: 'False Trail',
    desc: 'The Imposter can privately send misleading recommendations while the Crew gains truthful sabotage clues after failures.',
  },
];

export const IMPOSTER_ADVICE = [
  { id: 'higher', label: 'Recommend higher', icon: '⬆️' },
  { id: 'lower', label: 'Recommend lower', icon: '⬇️' },
  { id: 'agree', label: 'Recommend this position', icon: '👍' },
  { id: 'swap', label: 'Recommend a swap', icon: '🔄' },
];
