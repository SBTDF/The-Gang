# The Gang - Imposter Mode Design

## Status

This document describes the implemented Imposter mode. Classic mode remains unchanged.

## Core rules

Imposter mode adds one hidden Imposter to the existing poker/heist game. The server assigns the role when the host starts the match and sends it only through the private `YOUR_ROLE` event.

The Imposter still selects and confirms chips like every other player so they can blend in. The Imposter's chip and real hand are excluded from heist-success validation. Only the Crew hand order, sorted by the Crew-selected red chips, determines whether the heist succeeds.

The Crew wins after three successful heists. The Imposter wins after three failed heists. The identity is revealed only after the match ends. The Imposter's real hand is never shown to Crew players; Crew sees only the server-generated public decoy hand during showdown.

There is no in-game accusation or automatic suspicion indicator. If the Crew identifies the Imposter, they benefit by ignoring that player's recommendations and choosing trusted Crew players for coordination resources.

## Challenge catalog

There are exactly three Imposter challenges. Each challenge has exactly two independent buffs: one for the Imposter and one for the Crew. Both buffs are active together, affect different gameplay areas, and can progress independently. All three challenges may be active at the same time.

Every active challenge starts at Level 1 for both sides. After a successful Crew heist, that challenge's Imposter level increases, capped at Level 2. After a failed Crew heist, that challenge's Crew level increases, capped at Level 2. The resulting levels apply to the next heist. Uses reset at the start of every heist.

### 1. Open Book

Open Book is explicitly an Imposter-side information advantage paired with a separate Crew board-information advantage.

#### Imposter buff - Crew Hand Recon

- Level 1: at the start of the next heist, the server randomly selects one Crew player and privately sends the Imposter that player's complete real hand.
- Level 2: the Imposter privately receives every Crew player's complete real hand.

The Imposter is never included in this data. The hand data is never included in public `ROOM_STATE` or sent to Crew clients.

#### Crew buff - Community Forecast

- Level 1: every Crew player privately receives one actual upcoming community card.
- Level 2: every Crew player privately receives the next two actual community cards.

The forecast does not alter the deck or board order. It is early information about the shared board, not a role reveal or a counter to Crew Hand Recon.

### 2. Blueprint

Blueprint separates private placement intelligence from Crew decision recovery.

#### Imposter buff - Position Blueprint

- Level 1: the server randomly selects one Crew player; the Imposter privately sees that player's correct Crew-only position and ideal chip value.
- Level 2: the Imposter privately sees the complete Crew-only ranking and ideal chip assignment, including a plausible public decoy slot for the Imposter.

The ranking and assignment are generated server-side and never appear in public room state.

#### Crew buff - Reroute

- Level 1: the Crew receives one use during the next heist.
- Level 2: the Crew receives two uses during the next heist.

Each use asks the server to reopen one eligible, unconfirmed Crew decision in the current chip phase and replace it with a different legal available chip. The server chooses the affected Crew decision, so the request cannot probe hidden roles. The Imposter chip is never changed.

### 3. False Trail

False Trail separates private misinformation from peer coordination.

#### Imposter buff - Legal Decoy Suggestion

- Level 1: once during the next heist, the Imposter may privately send one fixed alternative chip suggestion to a selected player.
- Level 2: the Imposter may send two suggestions during separate chip decisions.

The server validates that the suggestion is a different legal chip currently available. The suggestion does not change the target's selection or room state and cannot spoof arbitrary system messages or Socket.IO events.

#### Crew buff - Crew Verification

- Level 1: the Crew receives one use during the next heist.
- Level 2: the Crew receives two uses during the next heist.

A use requests a second player's review of a visible chip decision. The selected verifier may accept the choice or ask the player to reconsider. It does not reveal roles, provide a truth oracle, or change the chip automatically. The Crew can use suspicion and trust to choose whom to ask.

## Privacy boundaries

The server owns role assignment, challenge progression, random target selection, private hands, forecasts, rankings, suggestions, and verification validation.

Public `ROOM_STATE` may include the selected mode, active challenge IDs, public chip selections, public decoy cards, and role-neutral public history. It must never include:

- `imposterPlayerId` before game over;
- the Imposter's real cards;
- private Crew forecasts;
- private Imposter hand or ranking intel;
- private challenge levels or usage records that reveal a role.

Role-specific challenge data is sent through `PRIVATE_CHALLENGE_STATE` only to the intended socket. Role assignment is sent through `YOUR_ROLE`. False Trail suggestions and Crew Verification requests/results use dedicated private Socket.IO events.

## Lifecycle and reset rules

Challenge data is prepared after cards are dealt at the start of every heist. Private targets and forecasts are generated independently for that heist. Imposter and Crew usage counters reset for the next heist. Switching mode in the lobby and returning to the lobby clear role, private challenge data, usage state, verification requests, decoy cards, and public Imposter history.

The existing in-memory room and single-instance Socket.IO architecture are sufficient. No database, Redis, persistence, or multi-instance changes are required for this mode.
