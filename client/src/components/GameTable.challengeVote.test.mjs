import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'client/src/components/GameTable.jsx');
const source = fs.readFileSync(filePath, 'utf8');

test('GameTable defines challenge vote state for Retina/Fingerprint voting', () => {
  assert.match(source, /const \[challengeVote, setChallengeVote\] = useState\(\{\s*cardRank:\s*null,\s*handRank:\s*null\s*\}\);/s, 'Challenge vote state should be initialized before submission.');
  assert.match(source, /socket\.emit\('SUBMIT_GUESS'/, 'GameTable should submit votes through the server event.');
});

test('GameTable scopes local chip drafts to the active phase and confirms the server value', () => {
  assert.match(source, /selectedChipColor/);
  assert.match(source, /selectedChipColor === currentChipColor/);
  assert.match(source, /socket\.emit\('CONFIRM_CHIP_SELECTION', \{ chipValue: myRoundChoice \}\)/);
});
