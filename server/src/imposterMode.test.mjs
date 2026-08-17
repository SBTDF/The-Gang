import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRoom,
  getCrewPlayers,
  getPrivateChallengeData,
  getPlayerRole,
  PHASES,
  preparePrivateChallengeData,
  requestCrewVerification,
  respondCrewVerification,
  returnToLobby,
  selectChip,
  sanitizeRoomForClient,
  setGameMode,
  startGame,
  submitImposterAdvice,
  useCrewReroute,
} from './gameEngine.js';
import {
  createChallengeProgress,
  incrementChallengeProgress,
  resetChallengeUses,
} from './imposterMode.js';
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

  const classic = createRoom('classic', 'Classic', 3);
  assert.equal(getPlayerRole(classic, 'classic'), null);
});

test('all active challenges start with independent Level 1 buffs and progress separately', () => {
  const progress = createChallengeProgress(['openBook', 'blueprint', 'falseTrail']);
  for (const entry of Object.values(progress)) {
    assert.equal(entry.imposterLevel, 1);
    assert.equal(entry.crewLevel, 1);
  }

  const room = makeImposterRoom();
  incrementChallengeProgress(room, true);
  assert.equal(room.challengeProgress.openBook.imposterLevel, 2);
  assert.equal(room.challengeProgress.openBook.crewLevel, 1);
  assert.equal(room.challengeProgress.blueprint.imposterLevel, 2);
  assert.equal(room.challengeProgress.falseTrail.imposterLevel, 2);

  incrementChallengeProgress(room, false);
  assert.equal(room.challengeProgress.openBook.imposterLevel, 2);
  assert.equal(room.challengeProgress.openBook.crewLevel, 2);
  resetChallengeUses(room);
  assert.equal(room.challengeProgress.falseTrail.adviceUsed, 0);
  assert.equal(room.challengeProgress.blueprint.rerouteUsed, 0);
  assert.equal(room.challengeProgress.falseTrail.verificationUsed, 0);
});

test('Open Book gives only the Imposter private Crew hands and Crew private board forecast', () => {
  const room = makeImposterRoom();
  const crew = getCrewPlayers(room);
  const imposterData = getPrivateChallengeData(room, room.imposterPlayerId);

  assert.equal(imposterData.openBook.level, 1);
  assert.ok(imposterData.openBook.target);
  assert.ok(crew.some((player) => player.id === imposterData.openBook.target.playerId));
  assert.equal(imposterData.openBook.target.playerId === room.imposterPlayerId, false);

  for (const player of crew) {
    const data = getPrivateChallengeData(room, player.id);
    assert.ok(data.openBook.forecast.length >= 1);
    assert.equal(data.openBook.target, undefined);
    assert.equal(data.openBook.hands, undefined);
    assert.deepEqual(data.openBook.forecast[0].card, room.deck[0]);
  }

  room.challengeProgress.openBook.imposterLevel = 2;
  room.challengeProgress.openBook.crewLevel = 2;
  preparePrivateChallengeData(room);
  assert.deepEqual(
    getPrivateChallengeData(room, room.imposterPlayerId).openBook.hands.map((hand) => hand.playerId).sort(),
    crew.map((player) => player.id).sort(),
  );
  assert.equal(getPrivateChallengeData(room, crew[0].id).openBook.forecast.length, 2);
});

test('public room state excludes the role and all private challenge information', () => {
  const room = makeImposterRoom();
  const crew = getCrewPlayers(room)[0];
  const publicState = sanitizeRoomForClient(room, crew.id);

  assert.equal(publicState.imposterPlayerId, undefined);
  assert.equal(publicState.challengeProgress, undefined);
  assert.equal(publicState.privateChallengeData, undefined);
  assert.equal(publicState.players.find((player) => player.id === room.imposterPlayerId).cards, null);
  assert.equal(publicState.players.find((player) => player.id === crew.id).cards.length > 0, true);
});

test('Blueprint gives randomized Imposter placement intel and Crew Reroute without touching Imposter state', () => {
  const room = makeImposterRoom();
  const crew = getCrewPlayers(room);
  const imposterData = getPrivateChallengeData(room, room.imposterPlayerId);
  assert.ok(imposterData.blueprint.target);
  assert.ok(crew.some((player) => player.id === imposterData.blueprint.target.playerId));
  assert.equal(getPrivateChallengeData(room, crew[0].id).blueprint.reroute, true);

  assert.equal(selectChip(room, crew[0].id, 1).ok, true);
  const imposterChipBefore = room.roundSelections[room.imposterPlayerId];
  const reroute = useCrewReroute(room, crew[1].id, 2);
  assert.equal(reroute.ok, true);
  assert.equal(room.roundSelections[room.imposterPlayerId], imposterChipBefore);
  assert.equal(room.challengeProgress.blueprint.rerouteUsed, 1);
});

test('False Trail sends a legal private alternative and Crew Verification is a separate coordination resource', () => {
  const room = makeImposterRoom();
  const crew = getCrewPlayers(room);
  assert.equal(selectChip(room, crew[0].id, 1).ok, true);

  const advice = submitImposterAdvice(room, room.imposterPlayerId, crew[0].id, 2);
  assert.equal(advice.ok, true);
  assert.equal(advice.advice.suggestedChipValue, 2);
  assert.equal(room.roundSelections[crew[0].id], 1);
  assert.equal(submitImposterAdvice(room, room.imposterPlayerId, crew[0].id, 3).error, 'No False Trail advice remains');

  const request = requestCrewVerification(room, crew[1].id, crew[0].id, crew[2].id);
  assert.equal(request.ok, true);
  assert.equal(room.challengeProgress.falseTrail.verificationUsed, 1);
  const response = respondCrewVerification(room, crew[2].id, request.request.requestId, false);
  assert.equal(response.ok, true);
  assert.equal(response.result.decision, 'RECONSIDER');
  assert.equal(room.crewVerificationRequest, null);
});

test('Imposter actions stay phase-bound and do not mutate state after the heist', () => {
  const room = makeImposterRoom();
  const crew = getCrewPlayers(room);
  room.gameState = PHASES.GAME_OVER;
  const before = JSON.stringify({ privateChallengeData: room.privateChallengeData, history: room.publicSabotageHistory });

  assert.equal(submitImposterAdvice(room, room.imposterPlayerId, crew[0].id, 2).error, 'False Trail advice is unavailable in this phase');
  assert.equal(useCrewReroute(room, crew[0].id, 2).error, 'Reroute is unavailable in this phase');
  assert.equal(JSON.stringify({ privateChallengeData: room.privateChallengeData, history: room.publicSabotageHistory }), before);
});

test('Switching modes and returning to lobby clear all Imposter-only state', () => {
  const room = makeImposterRoom();
  room.gameState = PHASES.LOBBY;
  room.revealedImposterId = room.imposterPlayerId;
  room.crewVerificationRequest = { requestId: 'stale' };

  assert.equal(setGameMode(room, GAME_MODES.CLASSIC).ok, true);
  assert.equal(room.imposterPlayerId, null);
  assert.deepEqual(room.challengeProgress, {});
  assert.deepEqual(room.privateChallengeData, {});
  assert.equal(room.crewVerificationRequest, null);

  assert.equal(setGameMode(room, GAME_MODES.IMPOSTER).ok, true);
  room.challenges = ['openBook'];
  assert.equal(startGame(room).ok, true);
  room.gameState = PHASES.GAME_OVER;
  assert.equal(returnToLobby(room).ok, true);
  assert.equal(room.imposterPlayerId, null);
  assert.deepEqual(room.challengeProgress, {});
  assert.equal(room.crewVerificationRequest, null);
});
