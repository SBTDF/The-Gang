# Project Spec: "The Gang" - Online Multiplayer Card Game (Part 2: Server & Deployment)

## 1. Server & Networking Infrastructure

To allow 3-6 players to play together online, we need a central server. This server acts as the "dealer" and the "rulebook."

### 1.1 Environment Setup
- **Directory Structure:**
    - `/client`: The React frontend (Vite).
    - `/server`: The Node.js backend.
- **Server Setup:**
    - Initialize a Node.js project.
    - Install `express`, `socket.io`, and `cors`.
    - Create an HTTP server and attach Socket.io to it.
- **Client Setup:**
    - Install `socket.io-client`.
    - Connect to the server URL (defined in `.env`).

### 1.2 Room Management (Lobby System)
The server must hold a map of active rooms. A Room represents a single game session.

- **Data Structure (Server Memory):**
    ```javascript
    rooms = {
      "ABCD": {
        hostId: "socketId123",
        players: [
          { id: "socketId123", name: "Alice", cards: [], chips: {} },
          { id: "socketId456", name: "Bob", cards: [], chips: {} }
        ],
        gameState: "LOBBY", // LOBBY, PRE_FLOP, FLOP, etc.
        deck: [],
        communityCards: [],
        challenges: []
      }
    }
Joining Flow:

Host clicks "Create Room". Server generates a 4-letter Room Code (e.g., "GANG").
Host shares the Code.
Other players enter their Name and the Code, then click "Join Room".
Server validates the Room exists and is not full (max 6).
Server adds the player to the room and broadcasts the updated player list to everyone.
1.3 Socket.io Event Contract (Crucial)
The client and server communicate via these events. All game logic validation happens on the server.

Client -> Server (Emitting)

CREATE_ROOM: { playerName } -> Server creates room, returns ROOM_CREATED with roomCode.

JOIN_ROOM: { playerName, roomCode } -> Server validates and returns ROOM_JOINED or ERROR.

START_GAME: { roomCode } -> Host starts the match.

SELECT_CHIP: { roomCode, chipValue, targetPlayerId? } -> Player attempts to take/steal a chip.

CHAT_MESSAGE: { roomCode, emojiId } -> Player sends a preset reaction.

Server -> Client (Listening)

ROOM_UPDATE: { players: [...] } -> Sent when someone joins/leaves.

GAME_STARTED: { yourCards: [...] } -> Sent when the host starts the game.

PHASE_UPDATE: { phase: "FLOP", communityCards: [...], availableChips: [1,2,3] } -> Sent to move the game forward.

CHIP_UPDATED: { playerId, chipValue, availableChips: [...] } -> Sent when any chip is moved.

SHOWDOWN_STEP: { playerId, hand: [...] } -> Sent to reveal a specific player's cards.

GAME_OVER: { result: "WIN" | "LOSE", vault: 3, alarms: 2 }.

Rule Enforcement: The server MUST ignore SELECT_CHIP events if the player is trying to take a chip that doesn't exist or is trying to hold two chips of the same color.

2. Technical Implementation Details
2.1 Server State (Socket.io Events)
ROOM_CREATE, ROOM_JOIN, GAME_START

CHIP_SELECT: Client sends { chipValue, targetPlayerId (optional) }.

SERVER_VALIDATE: Server checks legality (is it the right round? Is there room?).

SERVER_BROADCAST: Updates all clients with new chip positions.

PHASE_CHANGE: Server reveals community cards or moves to Showdown.

SHOWDOWN_STEP: Server asks specific player to reveal.

2.2 Frontend State (Zustand)
gamePhase: String.

myCards: Array.

communityCards: Array.

chips: Object mapping playerId -> chipValue.

activeChips: Array of available chip values.

opponents: Array of { id, name, chipValue, cardCount }.

2.3 Security
Do not send other players' card data to the client.

Server only sends "Card Backs" until a player is officially revealed in Showdown.

Server validates all chip moves.

3. Deployment & Free Cloud Hosting
3.1 Architecture
Frontend: React app (can be served statically).

Backend: Node.js + Socket.io server (requires WebSocket support).

3.2 Recommended Free Stack
Backend Hosting: Render.com (Free Tier)

Supports WebSockets.

Auto-deploys from GitHub.

Sleeps after 15 min inactivity (auto-wakes on connection).

URL format: https://your-app.onrender.com.

Frontend Hosting Options:

Option A (Recommended for simplicity): Serve the static React build from the same Express server on Render. (Less moving parts).

Option B: Vercel or Netlify (Free tier, excellent CDN).

Option C: GitHub Pages (Free, but requires separate backend URL).

3.3 Environment Variables
text
# Server (.env)
PORT=3001
CLIENT_URL=https://your-app.vercel.app  // Or * for testing

# Client (.env)
VITE_SERVER_URL=https://your-app.onrender.com
3.4 Step-by-Step Deployment Guide (Render + Vercel)
Push Code to GitHub

Create a repository for your project.

Push the /client and /server folders.

Deploy Backend to Render.com

Go to Render.com and sign up with GitHub.

Click "New +" -> "Web Service".

Connect your GitHub repository.

Render might auto-detect the Node.js app. If not, set:

Root Directory: server

Build Command: npm install

Start Command: node index.js

Choose the Free instance type.

Click "Create Web Service".

Wait 2-3 minutes for deployment.

Copy the URL (e.g., https://the-gang.onrender.com).

Deploy Frontend to Vercel

Go to Vercel.com and sign up with GitHub.

Click "Add New" -> "Project".

Import your GitHub repository.

Set Root Directory: client

Framework Preset: Vite

Add Environment Variable: VITE_SERVER_URL = https://the-gang.onrender.com.

Click "Deploy".

Copy the Vercel URL.

Test the Game

Open the Vercel URL in two different browsers (or a normal and incognito window).

Create a room in one, join in the other.

Verify real-time updates work.

Important Notes on Free Tier:

The first connection after the server sleeps takes ~30-60 seconds (cold start).

While players are actively connected, the server will not sleep.

If a game is not active for 15 minutes, the server sleeps to save resources.

4. Example Server Code Structure (Reference)
4.1 server/package.json
json
{
  "name": "the-gang-server",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "socket.io": "^4.5.0",
    "cors": "^2.8.5"
  }
}
4.2 server/index.js (Skeleton)
javascript
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// In-memory rooms storage
const rooms = {};

// Helper: Generate 4-letter room code
function generateRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return rooms[code] ? generateRoomCode() : code;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('CREATE_ROOM', ({ playerName }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      hostId: socket.id,
      players: [{ id: socket.id, name: playerName, cards: [], chips: {} }],
      gameState: 'LOBBY',
      deck: [],
      communityCards: [],
      challenges: []
    };
    socket.join(roomCode);
    socket.emit('ROOM_CREATED', { roomCode });
    io.to(roomCode).emit('ROOM_UPDATE', { players: rooms[roomCode].players });
  });

  socket.on('JOIN_ROOM', ({ playerName, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('ERROR', { message: 'Room not found' });
      return;
    }
    if (room.players.length >= 6) {
      socket.emit('ERROR', { message: 'Room is full' });
      return;
    }
    room.players.push({ id: socket.id, name: playerName, cards: [], chips: {} });
    socket.join(roomCode);
    socket.emit('ROOM_JOINED', { roomCode });
    io.to(roomCode).emit('ROOM_UPDATE', { players: room.players });
  });

  socket.on('disconnect', () => {
    // Remove player from any room they were in
    for (const [code, room] of Object.entries(rooms)) {
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(code).emit('ROOM_UPDATE', { players: room.players });
        if (room.players.length === 0) {
          delete rooms[code];
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
4.3 client/src/config.js
javascript
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 
                  (window.location.hostname === 'localhost' 
                    ? 'http://localhost:3001' 
                    : 'https://your-app.onrender.com');

export default SERVER_URL;
4.4 client/src/socket.js
javascript
import { io } from 'socket.io-client';
import SERVER_URL from './config';

export const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});
text

---

## How to Use These Files

1. Copy **File 1** content and save as `The-Gang-Spec-Part1.md`
2. Copy **File 2** content and save as `The-Gang-Spec-Part2.md`
3. Give both files to Cursor.
4. Tell Cursor: *"Read both files. Part 1 is the game rules and UI. Part 2 is the server, networking, and deployment. Build according to these specs."*

This split ensures no single file is too long to break. Good luck with your game!