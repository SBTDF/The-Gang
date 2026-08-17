import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'client/src/components/ImposterPanel.jsx'), 'utf8');

test('ImposterPanel keeps private intel actions on dedicated Socket.IO events', () => {
  assert.match(source, /socket\.emit\('SELECT_IMPOSTER_TARGET'/);
  assert.match(source, /socket\.emit\('IMPOSTER_ADVICE'/);
  assert.match(source, /You are the Imposter/);
  assert.match(source, /You are Crew/);
});

test('ImposterPanel renders Blueprint clues and Crew-only sabotage evidence', () => {
  assert.match(source, /privateChallengeState\.blueprint\.clue/);
  assert.match(source, /sabotageClue\.category/);
  assert.match(source, /falseTrailAdvice\.label/);
});
