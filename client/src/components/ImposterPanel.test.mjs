import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'client/src/components/ImposterPanel.jsx'), 'utf8');

test('ImposterPanel keeps the six buffs on dedicated private Socket.IO flows', () => {
  assert.match(source, /socket\.emit\('IMPOSTER_ADVICE'/);
  assert.match(source, /socket\.emit\('CREW_REROUTE'/);
  assert.match(source, /socket\.emit\('REQUEST_CREW_VERIFICATION'/);
  assert.match(source, /socket\.emit\('RESPOND_CREW_VERIFICATION'/);
  assert.match(source, /Open Book — Crew Hand Recon/);
  assert.match(source, /Open Book — Community Forecast/);
  assert.match(source, /Blueprint — Position Blueprint/);
  assert.match(source, /Blueprint — Reroute/);
  assert.match(source, /False Trail — Legal Decoy Suggestion/);
  assert.match(source, /False Trail — Crew Verification/);
});

test('ImposterPanel does not render the Imposter hand or legacy Crew sabotage clue', () => {
  assert.doesNotMatch(source, /sabotageClue\.category/);
  assert.doesNotMatch(source, /targetOptions/);
  assert.doesNotMatch(source, /blueprint\.clue/);
  assert.match(source, /privateChallengeState\.openBook\.forecast/);
  assert.match(source, /suggestedChipValue/);
});
