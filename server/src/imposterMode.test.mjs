import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRoom,
  getCrewPlayers,
  getPrivateChallengeData,
  getPlayerRole,
  PHASES,
  preparePrivateChallengeData,
  returnToLobby,
  selectImposterTarget,
  setGameMode,
  startGame,
  submitImposterAdvice,
} from './gameEngine.js';
import { GAME_MODES } from './imposterMode.js';

function makeImposterRoom() {
  const room = createRoom('p1', 'Player 1', 4);
  room.players.push(
    { id: 'p2', name: 'Player 2', cards: [], publicShowdownCards: [], chips: {}, connected: true },
    { id: 'p3', name: 'Player 3', cards: [], publicShowdownCards: [], chips: {}, connected: true },
    { id: 'p4', name: 'Player 4', cards: [], publicShowdownCards: [], chips: {}, connected: true },
  );
  assert.equal(setGameMode(room, GAME_MODES.IMPOSTER).ok, true);
  room.challenges = ['openBook', 'blueprint', 'falseTrail'];
  assert.equal(startGame(room).ok, true);
  return room;
}

test('Imposter mode assigns one hidden role and keeps Classic role-free', () => {
  const room = makeImposterRoom();
  const crew = getCrewPlayers(room);

  assert.equal(crew.length, 3);
  assert.equal(getPlayerRole(room, room.imposterPlayerId), 'IMPOSTER');
  assert.equal(getPlayerRole(room, crew[0].id), 'CREW');
  assert.equal(getPrivateChallengeData(room, crew[0].id).openBook, null);

  const classic = createRoom('classic', 'Classic', 3);
  assert.equal(getPlayerRole(classic, 'classic'), null);
});

test('Open Book is an Imposter-only buff with eligible Crew targets', () => {
  const room = makeImposterRoom();
  room.challengeProgress.openBook.imposterLevel = 1;
  preparePrivateChallengeData(room);

  const crew = getCrewPlayers(room);
  for (const player of crew) {
    assert.equal(getPrivateChallengeData(room, player.id).openBook, null);
  }

  const imposterIntel = getPrivateChallengeData(room, room.imposterPlayerId);
  assert.equal(imposterIntel.openBook, null);
  const openBookOptions = imposterIntel.targetOptions.find((item) => item.challengeId === 'openBook');
  assert.deepEqual(openBookOptions.players.map((player) => player.playerId).sort(), crew.map((player) => player.id).sort());

  const target = crew[0];
  const selected = selectImposterTarget(room, room.imposterPlayerId, 'openBook', target.id);
  assert.equal(selected.ok, true);
  assert.equal(selected.data.openBook.target.playerId, target.id);
  assert.deepEqual(selected.data.openBook.target.cards, target.cards);

  const rejectedReplacement = selectImposterTarget(room, room.imposterPlayerId, 'openBook', crew[1].id);
  assert.equal(rejectedReplacement.error, 'This Intel target has already been selected');
  assert.equal(getPrivateChallengeData(room, room.imposterPlayerId).openBook.target.playerId, target.id);
  assert.equal(selectImposterTarget(room, room.imposterPlayerId, 'openBook', room.imposterPlayerId).error, 'Intel target must be a Crew player');

  room.challengeProgress.openBook.imposterLevel = 2;
  preparePrivateChallengeData(room);
  assert.deepEqual(
    getPrivateChallengeData(room, room.imposterPlayerId).openBook.hands.map((hand) => hand.playerId).sort(),
    crew.map((player) => player.id).sort(),
  );
  for (const player of crew) assert.equal(getPrivateChallengeData(room, player.id).openBook, null);
});

test('Blueprint Crew level 1 provides one actionable truthful placement clue', () => {
  const room = makeImposterRoom();
  room.challengeProgress.blueprint.crewLevel = 1;
  preparePrivateChallengeData(room);

  const clue = getPrivateChallengeData(room, getCrewPlayers(room)[0].id).blueprint.clue;
  assert.ok(clue.text);
  assert.match(clue.text, /should rank above|belongs in the top|are tied/);
  assert.equal(clue.text.includes('position'), false);
});

test('Imposter target selection and False Trail advice stay server-authoritative', () => {
  const room = makeImposterRoom();
  room.challengeProgress.openBook.imposterLevel = 1;
  room.challengeProgress.falseTrail.imposterLevel = 1;
  preparePrivateChallengeData(room);
  const target = getCrewPlayers(room)[0];

  const intel = selectImposterTarget(room, room.imposterPlayerId, 'openBook', target.id);
  assert.equal(intel.ok, true);
  assert.equal(intel.data.openBook.target.playerId, target.id);

  const advice = submitImposterAdvice(room, room.imposterPlayerId, target.id, 'higher');
  assert.equal(advice.ok, true);
  assert.equal(advice.targetId, target.id);
  assert.equal(room.challengeProgress.falseTrail.adviceUsed, 1);
  assert.equal(submitImposterAdvice(room, room.imposterPlayerId, target.id, 'lower').error, 'No False Trail advice remains');
});

test('Imposter target selection is rejected outside active chip phases without mutation', () => {
  const room = makeImposterRoom();
  room.challengeProgress.openBook.imposterLevel = 1;
  preparePrivateChallengeData(room);
  const target = getCrewPlayers(room)[0];

  room.gameState = PHASES.HEIST_RESULT;
  const before = JSON.stringify(room.privateChallengeData);
  const result = selectImposterTarget(room, room.imposterPlayerId, 'openBook', target.id);

  assert.equal(result.error, 'Intel target selection is unavailable in this phase');
  assert.equal(JSON.stringify(room.privateChallengeData), before);
});

test('False Trail advice is accepted during chip phases and rejected after the phase ends', () => {
  const room = makeImposterRoom();
  room.challengeProgress.falseTrail.imposterLevel = 1;
  preparePrivateChallengeData(room);
  const target = getCrewPlayers(room)[0];

  const valid = submitImposterAdvice(room, room.imposterPlayerId, target.id, 'higher');
  assert.equal(valid.ok, true);
  assert.equal(room.challengeProgress.falseTrail.adviceUsed, 1);

  room.challengeProgress.falseTrail.adviceUsed = 0;
  room.challengeProgress.falseTrail.adviceDecisionKeys = [];
  room.gameState = PHASES.SHOWDOWN;
  const beforeHistory = room.publicSabotageHistory.length;
  const invalid = submitImposterAdvice(room, room.imposterPlayerId, target.id, 'lower');

  assert.equal(invalid.error, 'False Trail advice is unavailable in this phase');
  assert.equal(room.challengeProgress.falseTrail.adviceUsed, 0);
  assert.equal(room.publicSabotageHistory.length, beforeHistory);
});

test('Imposter actions are rejected after GAME_OVER', () => {
  const room = makeImposterRoom();
  room.challengeProgress.openBook.imposterLevel = 1;
  room.challengeProgress.falseTrail.imposterLevel = 1;
  preparePrivateChallengeData(room);
  room.gameState = PHASES.GAME_OVER;
  const target = getCrewPlayers(room)[0];
  const before = JSON.stringify({ privateChallengeData: room.privateChallengeData, history: room.publicSabotageHistory });

  assert.equal(selectImposterTarget(room, room.imposterPlayerId, 'openBook', target.id).error, 'Intel target selection is unavailable in this phase');
  assert.equal(submitImposterAdvice(room, room.imposterPlayerId, target.id, 'higher').error, 'False Trail advice is unavailable in this phase');
  assert.equal(JSON.stringify({ privateChallengeData: room.privateChallengeData, history: room.publicSabotageHistory }), before);
});

test('Switching modes defensively clears Imposter-only state', () => {
  const room = makeImposterRoom();
  room.gameState = PHASES.LOBBY;
  room.revealedImposterId = room.imposterPlayerId;
  room.players[0].publicShowdownCards = [{ rank: 'A', suit: 'spades' }];
  room.publicSabotageHistory.push({ category: 'communication' });

  assert.equal(setGameMode(room, GAME_MODES.CLASSIC).ok, true);
  assert.equal(room.imposterPlayerId, null);
  assert.deepEqual(room.challengeProgress, {});
  assert.deepEqual(room.privateChallengeData, {});
  assert.deepEqual(room.publicSabotageHistory, []);
  assert.equal(room.revealedImposterId, undefined);
  assert.deepEqual(room.players[0].publicShowdownCards, []);

  assert.equal(setGameMode(room, GAME_MODES.IMPOSTER).ok, true);
  assert.equal(room.imposterPlayerId, null);
  assert.deepEqual(room.challengeProgress, {});
  assert.deepEqual(room.privateChallengeData, {});
});

test('Returning to lobby clears Imposter state before another match', () => {
  const room = makeImposterRoom();
  room.gameState = PHASES.GAME_OVER;
  room.publicSabotageHistory.push({ category: 'communication' });

  assert.equal(returnToLobby(room).ok, true);
  assert.equal(room.gameState, PHASES.LOBBY);
  assert.equal(room.imposterPlayerId, null);
  assert.deepEqual(room.challengeProgress, {});
  assert.deepEqual(room.privateChallengeData, {});
  assert.deepEqual(room.publicSabotageHistory, []);

  room.challenges = ['openBook'];
  room.imposterPlayerId = 'stale-id';
  assert.equal(startGame(room).ok, true);
  assert.ok(room.players.some((player) => player.id === room.imposterPlayerId));
  assert.notEqual(room.imposterPlayerId, 'stale-id');
  assert.equal(getPlayerRole(room, room.imposterPlayerId), 'IMPOSTER');
});
