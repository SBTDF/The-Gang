# The Gang — Imposter Mode Design

## Status

This document describes the proposed design only. It is not an implementation plan that has been applied to the game yet.

The goal is to add a second game mode while preserving the existing Classic mode, poker rules, lobby flow, Socket.IO architecture, and Render deployment.

## 1. High-level concept

Imposter mode is a hidden-role version of the existing cooperative poker heist.

There is one secret Imposter and the remaining players are Crew members.

The Imposter’s goal is to make the Crew fail heists while appearing to be a normal Crew member. The Crew’s goal is to complete three successful heists and identify the Imposter through their decisions, recommendations, and sabotage patterns.

The most important rule is:

> The Imposter may participate in chip selection, but the Imposter’s chip and hand never determine whether the Crew ranking succeeds.

This prevents the Imposter from simply selecting the wrong chip every round and making the game unwinnable by themselves.

## 2. Game modes

### Classic mode

Classic mode remains unchanged:

- all players participate in chip ranking;
- all players’ hands are included in showdown validation;
- the existing ten cooperative challenges remain available;
- the current vault/alarm rules remain unchanged.

### Imposter mode

Imposter mode uses:

- one hidden Imposter;
- Crew-only ranking validation;
- Imposter sabotage abilities;
- progressive Imposter and Crew buffs;
- a separate Imposter challenge catalog; the first version contains three challenges and can later expand to ten.

Classic challenges and Imposter challenges should use separate IDs and definitions. They should not be mixed initially because their balance assumptions are different.

## 3. Roles and victory conditions

At the moment the host starts an Imposter match:

1. The server randomly selects one player as the Imposter.
2. The selected player privately receives the Imposter role.
3. Every other player privately receives the Crew role.
4. The role remains fixed for all heists in that match.

The role assignment must happen on the server. It must never be selected by the client or included in the normal public room state.

### Crew victory

The Crew wins when the room reaches three successful heists.

### Imposter victory

The Imposter wins when the room reaches three failed heists.

The Imposter’s identity is revealed after the match ends, but the Imposter’s real hand is never shown to the other players.

## 4. Chip selection and ranking

The Imposter still participates visibly in normal chip selection:

- they select a legal chip;
- their selection appears in the lobby/game state like everyone else’s;
- they confirm their selection;
- they can discuss and recommend chip assignments;
- they can trade normally unless a challenge affects trading.

However, when the server evaluates the result, it uses only Crew players:

```text
Crew players
→ sort by red chip
→ compare Crew hands in that order
→ success if every Crew comparison is valid
```

The Imposter’s chip position is ignored for success validation. The Imposter’s hand is also excluded from the comparison.

This means an Imposter can choose a suspicious chip, but that choice cannot directly fail the heist.

The Imposter must instead influence the Crew into making a bad decision or use a sabotage ability that targets Crew information and coordination.

## 5. Why the Imposter still participates in chip selection

The Imposter’s visible participation is important for deception.

They should be able to:

- make reasonable chip choices;
- occasionally suggest a correct ranking;
- make mistakes that look genuine;
- appear helpful during trades and discussions;
- save sabotage abilities for moments when suspicion is low.

If the Imposter deliberately chooses an obviously wrong chip every round, the Crew should quickly stop trusting them. Since the chip does not affect the actual ranking, this behavior is not an automatic win for the Imposter.

## 6. Showdown presentation

The existing Classic showdown is based on a sequential chip-order comparison. Showing the exact same presentation in Imposter mode could accidentally reveal that one player was excluded from validation.

Imposter mode should therefore use a slightly different presentation:

- reveal player hands normally;
- do not expose the internal Crew-only comparison chain;
- do not show which specific comparison caused a failure;
- display a result such as `Crew alignment succeeded` or `Crew alignment failed`;
- do not expose the private `imposterPlayerId` or `effectiveCrewOrder`.

The Crew should see only the Imposter’s public decoy hand. The Imposter’s real cards remain private throughout the match and are not shown on the post-match screen. The UI should not state that the decoy hand was checked against a neighboring hand.

After the match, the UI may reveal:

- who the Imposter was;
- which side won;
- which sabotage challenges or buffs were used;
- a short result summary.

It should not reveal:

- the Imposter’s real cards;
- the difference between the real and decoy hands;
- unnecessary internal ranking information.

This keeps the post-match result focused and avoids cluttering the screen with information that is not needed to understand the outcome.

## 7. How identifying the Imposter helps the Crew

There should be no automatic `accuse` button or role-reveal function during the match.

The advantage of identifying the Imposter should come from how the Crew plays:

- ignore the Imposter’s ranking recommendations;
- stop relying on the Imposter’s card evaluations;
- avoid giving the Imposter control over important trades;
- require trusted Crew players to confirm important decisions;
- use Crew information and planning resources around the suspected player;
- watch for sabotage timing and misleading advice.

The game should support this with a generic mechanic rather than an accusation mechanic.

### Crew Plan

The Crew can use a limited `Crew Plan` or `Trusted Plan` resource on any player.

It is not labeled as an anti-Imposter action and does not reveal anyone’s role.

Possible uses include:

- designating a trusted player as the primary planner for a chip phase;
- requiring a second Crew confirmation for an important decision;
- allowing the Crew to submit a backup plan for a critical ranking decision;
- protecting one decision from being influenced by a suspicious recommendation.

If the Crew has identified the Imposter, they can avoid using that player as the planner. If they are wrong, they may waste a limited resource or follow the wrong player.

This makes early identification valuable without turning it into a formal accusation system.

## 8. Imposter sabotage philosophy

The Imposter should sabotage Crew decision-making rather than directly change the final result.

Sabotage should generally:

- obscure information;
- create uncertainty;
- make communication less reliable;
- pressure the Crew into a rushed decision;
- introduce misleading but plausible evidence;
- make the Crew’s own ranking more difficult.

Sabotage should not:

- directly add an alarm;
- directly remove vault progress;
- force an automatic failed heist;
- allow illegal chip selections;
- overwrite arbitrary room state from the client;
- make the Imposter’s own chip capable of failing the heist by itself.

The server should limit every sabotage action by phase, target, usage count, and challenge rules.

## 9. Challenge-based progressive buffs

The progression belongs to the active challenges. There are no selectable Intel or Countermeasure paths.

Each challenge contains exactly:

- one Imposter buff that progresses when the Crew wins a heist;
- one Crew buff that progresses when the Imposter wins a heist.

The host activates any combination of the available challenges in the lobby before the match starts. All three first-version challenges may be active simultaneously. There is no incompatibility map between them.

Each active challenge tracks its own levels:

```text
Crew heist success
→ every active challenge increases its Imposter buff level

Crew heist failure
→ every active challenge increases its Crew buff level
```

Level 1 applies after the first relevant result. Level 2 applies after the second relevant result. The buff applies to the next heist and is not chosen by either side.

### Challenge 1 — Open Book

This challenge is about increasingly powerful hand information.

#### Imposter progression

- Level 1: privately see the complete real hand of one chosen Crew player during the next heist.
- Level 2: privately see the complete real hands of every Crew player during the next heist.

#### Crew progression

- Level 1: every Crew player privately sees the complete real hand of one chosen player during the next heist.
- Level 2: every Crew player privately sees the complete real hands of every player during the next heist.

The selected player may be the Imposter, but the information must not identify their role. This gives both sides meaningful information without directly canceling the other side’s buff.

### Challenge 2 — Blueprint

This challenge is about knowing how hands should be arranged without changing the server’s normal ranking rules.

#### Imposter progression

- Level 1: privately see the correct Crew-only hand position and ideal chip placement for one chosen Crew player.
- Level 2: privately see the complete correct Crew-only ranking and ideal chip assignment.

#### Crew progression

- Level 1: every Crew player privately receives one accurate hand-strength relationship or placement clue.
- Level 2: every Crew player privately receives a complete server-generated recommended chip assignment for the next heist.

The Crew recommendation contains a plausible position for every player, including the Imposter’s decoy position. It is presented as a complete team plan and does not expose which player is excluded from real ranking validation.

### Challenge 3 — False Trail

This challenge gives the Imposter an active deception tool and gives the Crew progressively better evidence about sabotage.

#### Imposter progression

- Level 1: once during the next heist, privately send one misleading in-game recommendation to a chosen Crew player through the dedicated advice interface.
- Level 2: use the misleading recommendation twice during the next heist, on separate decisions.

The Imposter cannot spoof arbitrary system messages or Socket.IO events. The advice must use a clearly defined in-game message type so it can be validated and logged by the server.

#### Crew progression

- Level 1: after a sabotage resolves, the Crew receives one truthful clue about its category, such as chip, card, trade, or timing.
- Level 2: the Crew receives the category plus the affected phase or decision type.

These clues do not identify the Imposter or undo the sabotage. They help the Crew recognize patterns and stop trusting suspicious advice.

### Simultaneous activation

If all three challenges are active, all three progression tracks operate at the same time. For example, after one successful Crew heist, the Imposter may gain Level 1 Open Book, Level 1 Blueprint, and Level 1 False Trail simultaneously.

This is intentional. The lobby should clearly show each challenge as `ACTIVE` or `DISABLED`, and the host should be able to toggle them before starting the game.

The first version should cap each challenge at Level 2. The three-challenge set can later expand to ten challenges once the interaction between simultaneous progression tracks has been playtested.

The Imposter’s buffs and the Crew’s buffs should be sent privately by the server and should never be included in public `ROOM_STATE`.

## 11. Private and public state

The server would need separate public and private state.

Private state may include:

```js
room.imposterPlayerId
room.imposterState
room.imposterCharges
room.challengeProgress[challengeId].imposterLevel
room.challengeProgress[challengeId].crewLevel
```

Public state may include:

```js
room.gameMode
room.imposterChallengeIds
room.publicSabotageHistory
```

The following must never be included in normal `ROOM_STATE`:

- `imposterPlayerId`;
- the identity of the player who used sabotage;
- private Imposter information;
- internal Crew-only ranking order;
- private progression details that reveal the role.

The server should send role-specific information through a private event such as `YOUR_ROLE`.

## 12. Proposed Socket.IO flow

### Starting a match

```text
START_GAME
→ server verifies the host
→ server assigns the Imposter
→ server sends YOUR_ROLE privately
→ server broadcasts public ROOM_STATE
```

### Imposter action

```text
IMPOSTER_ACTION
→ server verifies sender is the Imposter
→ server validates phase, challenge, target, and remaining uses
→ server applies the sabotage
→ server broadcasts a role-neutral public result
→ server broadcasts updated ROOM_STATE
```

### Match result

```text
GAME_OVER
→ winner is CREW or IMPOSTER
→ Imposter identity is revealed
→ final buffs and sabotage history can be summarized
→ Imposter’s real hand remains private
```

## 13. Architecture boundaries

The first implementation should not require:

- a database;
- Redis;
- persistent role storage;
- multi-instance Socket.IO support;
- a new deployment architecture;
- changes to Classic mode’s game engine behavior.

The current in-memory room architecture is sufficient for the existing single-instance Render deployment.

## 14. Recommended implementation order

1. Add `CLASSIC` and `IMPOSTER` room modes.
2. Add server-side role assignment and private role events.
3. Make Imposter chip and hand data irrelevant to ranking validation.
4. Add the Imposter-mode showdown result flow without exposing the Crew-only ranking.
5. Add one basic sabotage ability.
6. Add progressive Imposter and Crew buffs.
7. Add the three first-version Imposter challenges with simultaneous activation.
8. Expand the catalog toward ten challenges only after the three-challenge combinations are balanced.
9. Add tests for role secrecy, Crew-only ranking, sabotage validation, simultaneous challenges, and progression.
10. Playtest balance before adding more active abilities.

## 15. Main risks to resolve before implementation

### Showdown information leakage

The UI must not reveal that one player was excluded from ranking. This is the largest technical risk.

### Imposter buffs becoming too strong

Seeing private Crew cards after every successful heist could become overwhelming if the Imposter receives too much information too quickly. The number of cards and buff levels should be capped.

### Crew buffs becoming direct counters

Crew compensation should remain useful but should not undo a specific sabotage. It should improve information, coordination, or hand quality instead.

### Role discovery being too weak

If the Imposter’s sabotage has no visible consequences, the Crew will have no way to reason about the role. Sabotage effects should leave public, role-neutral evidence without identifying the user automatically.

### Reconnection

The current application does not fully restore player identity across Socket.IO reconnects. Imposter mode should preserve the existing behavior initially rather than introduce persistence as part of this feature.

## Summary

The proposed mode is a hidden-role social deduction layer over the existing poker game:

```text
Imposter chip and hand
        ↓
excluded from success ranking

Crew chip and hand ranking
        ↓
determines heist success

Imposter sabotage and deception
        ↓
tries to make Crew players fail among themselves

Crew identification and coordination
        ↓
reduces the Imposter’s influence
```

This gives the Imposter a reason to stay hidden, gives the Crew a reason to identify them early, prevents unilateral chip griefing, and keeps the existing Classic mode intact.
