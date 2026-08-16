# Project Spec: "The Gang" - Online Multiplayer Card Game (Part 1: Game Rules & UI)

## 1. Overview & Goal
We are building a web-based, real-time multiplayer card game based on the physical game "The Gang".
- **Platform:** Responsive Web App (Playable on PC and Mobile browsers).
- **Players:** 3-6 players per room.
- **Core Mechanic:** Cooperative Texas Hold’em style poker, but players communicate hand strength via "Chips" rather than verbal discussion.
- **Objective:** Correctly rank hands from weakest to strongest using limited communication.

## 2. Technology Stack (Recommended)
- **Framework:** Vite + React (for responsive UI).
- **Real-time Networking:** WebSockets via **Socket.io**.
- **State Management:** Zustand (Client), Server-side authoritative state.
- **Styling:** Tailwind CSS (for fast, responsive design).
- **Backend:** Node.js (Express) + Socket.io server.
- **Deployment:** Render.com (Backend/Server) & Vercel/Netlify (Frontend).

## 3. Core Game Architecture

### 3.1 The Deck & Cards
- **Deck Construction:** Standard 52-card deck.
- **Card Model:** `{ suit: 'hearts'|'diamonds'|'clubs'|'spades', rank: '2'..'10'|'J'|'Q'|'K'|'A' }`
- **Shuffling:** Server-side Fisher-Yates shuffle.
- **Card Dealing:**
    - Pre-Flop: 2 cards per player (private).
    - Flop: 3 community cards (face up).
    - Turn: 1 community card.
    - River: 1 community card.

### 3.2 Poker Hand Evaluation
- **Requirement:** Server MUST evaluate hands authoritatively to prevent cheating.
- **Inputs:** 2 (or 3 with Security Camera challenge) pocket cards + 5 community cards.
- **Output:** The best 5-card hand.
- **Ranking Order (lowest to highest):**
    1. High Card
    2. Pair
    3. Two Pair
    4. Three of a Kind
    5. Straight
    6. Flush
    7. Full House
    8. Four of a Kind
    9. Straight Flush
    10. Royal Flush
- **Tie-breaking:** Must handle kickers (e.g., Pair of Kings with Ace kicker beats Pair of Kings with Queen kicker). Handle "True Ties" (e.g., both players use the board for a straight).

## 4. Game Phases (State Machine)

The server manages the game loop:

1.  **LOBBY:** Players join. Host starts the game (3-6 players).
2.  **PRE_FLOP:**
    - Deal 2 cards to each player.
    - Activate White Chips (values 1 to N, where N = number of players).
    - Players secretly select chips. (See "Chip Interaction Logic").
3.  **FLOP:**
    - Reveal 3 community cards.
    - Activate Yellow Chips.
    - Players select chips.
4.  **TURN:**
    - Reveal 1 community card.
    - Activate Orange Chips.
    - Players select chips.
5.  **RIVER:**
    - Reveal 1 community card.
    - Activate Red Chips.
    - Players select chips.
6.  **SHOWDOWN:**
    - Order players by Red Chip value (1 -> N).
    - Reveal hands sequentially.
    - Check if each hand is >= previous hand strength (using evaluator).
    - **Success:** Increment Heist counter (Vault). Go to next Heist or Victory.
    - **Failure:** Increment Alarm counter. Go to next Heist or Game Over.
7.  **GAME_OVER:**
    - Win: Complete 3 successful heists.
    - Lose: Fail 3 heists.

## 5. Chip Interaction Logic (Crucial UI/UX)

This is the core innovation of the game. It must feel fluid and responsive on both mobile and PC.

- **Rule:** Only the *current round's* chips are interactive.
- **Movement:** You can take a chip from the center pool, or steal the current round's chip from another player.
- **Constraint:** You may only ever have **1** chip of the current color.
- **Visualization:**
    - **Center Pool:** Show the remaining numbers (e.g., if players 2 and 4 are taken, show 1 and 3).
    - **Player Zones:** Show the chips players currently possess.
- **Interaction (Drag & Drop or Click):**
    - *Option A (Mobile Friendly):* Tap your chip -> Tap a center chip (Swap). Tap another player's chip (Steal).
    - *Option B (Desktop):* Drag your chip to the center or another player.
- **Server Authority:** The server validates that no player has >1 chip. If a player steals, the stolen chip returns to the center or is swapped (if the thief had a chip).

## 6. UI/UX Design Guidelines

### 6.1 Table Layout
- **Center:** Community cards (Empty slots to indicate future rounds).
- **Bottom/Hero:** Your pocket cards (large, clear).
- **Top/Other Players:** Their pocket cards (face down backs).
- **Around Players:** Their selected chips (persistent across rounds).
- **Sidebar:** Game log / Chat.
- **Top Bar:** Vault cards (Successes) vs Alarm cards (Failures).

### 6.2 Responsiveness
- **Mobile:** Use a "Poker table" background where players sit around the edges. The hero's cards are at the bottom. Community cards are central. Chips are tappable elements near each player.
- **PC:** Wider layout, larger cards, hover effects on chips.

## 7. Communication System (The "Chat")

Since players cannot talk about *specific* private card details, but need to coordinate on *relative* chip positions, we need a safe text/emoji system.

**Do NOT implement free-text chat.** It will break the game rules and lead to cheating.

**Recommended Solution: "Chip Logic Reactions"**
- **Contextual Menu:** When a player clicks/taps on an opponent's chip (or their own), they get a list of quick actions/messages.
- **Example Actions:**
    - "I should be higher than you." (Assert dominance)
    - "You are too high." (Tell them to go lower)
    - "I agree with your position." (Confirm)
    - "Let's swap."
    - "?"
- **Sticker/Emoji Reactions:**
    - Pointing Up/Down arrows.
    - "Safe" icon.
    - "Danger" icon.
- **Visual Indicators:** A speech bubble appears over the player's avatar showing the emoji/action.

This maintains the "meta-game" of negotiating chip positions without explicitly revealing hand details.

## 8. Game Setup & Start Menu

- **Main Menu:**
    - **Create Room:** Host sets player count (3-6) and selects optional challenges.
    - **Join Room:** Enter Room Code.
    - **Rules Button:** Opens a modal or panel containing the complete rules text provided in this prompt (formatted nicely). It should be accessible *during* the game via a "?" button without leaving the match.
    - **Hand Ranking Button:** Opens a modal showing the poker hand rankings (High Card -> Royal Flush) with illustrative examples. Accessible via a button on the table UI at all times.

## 9. Challenge Modes (Optional Add-ons)

These must be toggled by the host at the start. They alter the game logic significantly.

1.  **Quick Access:** Skip the White Chip (Pre-Flop) round. Go straight to dealing the Flop and Yellow Chips.
2.  **Noise Sensor:** If a player takes the "1-star" chip, it becomes "Locked." No one can steal it or return it to the center for that round.
3.  **Motion Detector:** (Flop evaluation) If any Flop card is a Face Card (J, Q, K): The player holding the "1-star" White Chip must discard their hand and draw 2 new cards.
4.  **Retina Scan:** (Pre-Showdown) Before the highest Red Chip player reveals, the other players must guess a specific *card value* (e.g., "Ace") in that player's hand. Guess wrong -> Heist Fails.
5.  **Hasty Getaway:** Skip the Orange Chip (Turn) round. Go straight to revealing the River and Red Chips.
6.  **Silent Alarm (Replacement for #6):** *Rationale: The physical game may have a challenge involving the discard pile or a specific suit. Since we don't recall #6, we add a logical one.*
    - **Rule:** During the Showdown, players may not use the Chat/Emote system. The Red Chip placement must stand entirely on its own.
7.  **Laser Tripwires:** (Flop evaluation) If NO Flop card is a Face Card: The player holding the highest White Chip must discard their hand and draw 2 new cards.
8.  **Blackout:** At the beginning of a new round (e.g., moving from Flop to Turn), clear all chips from the previous round. (History is hidden).
9.  **Fingerprint Scan:** (Pre-Showdown) Before the highest Red Chip player reveals, the other players must guess the exact *hand ranking* (e.g., "Flush"). Guess wrong -> Heist Fails.
10. **Security Camera:** All players receive 3 pocket cards instead of 2. (Hand evaluation logic must adjust to select best 5 of 8 cards).

## 10. MVP Checklist (For Vibe-coding)

1.  [ ] Basic Express + Socket.io Server running.
2.  [ ] Basic Lobby (Create/Join Room with a code).
3.  [ ] Server deals cards (2 pocket).
4.  [ ] UI renders my cards and opponent backs.
5.  [ ] UI renders community card slots.
6.  [ ] Chip System: Display 1..N chips. Allow click-to-take. Allow click-to-steal.
7.  [ ] Server enforces "1 chip per player" rule.
8.  [ ] Game Loop: Flop -> Turn -> River.
9.  [ ] Hand Evaluator (Basic: Pair, Two Pair, Trips, Straight, Flush).
10. [ ] Showdown Logic (Compare evaluated hands).
11. [ ] Win/Lose condition (3 Heists).
12. [ ] "Rules" and "Hand Ranking" buttons in UI.
13. [ ] Emote/Reaction system for coordination.
14. [ ] Deployed to Render.com/Vercel and playable over the internet.