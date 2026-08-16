Deployment guide — The Gang

This document explains two recommended deployment flows:

Option A (recommended): Backend on Render, Frontend on Vercel (separate services)
Option B: Single Render service that serves both (server serves built client)

Prerequisites
- A GitHub account and repository to push code to (Render/Vercel link to GitHub for CI).
- Render account (free tier) and/or Vercel account.
- Node 18+ and npm installed locally for local build and tests.

Common prep
1. Ensure the code is committed and pushed to a GitHub repo.
2. Ensure `server/package.json` has a `start` script (it does: `node index.js`).
3. Ensure `client/package.json` has `build` script (it does: `vite build`).
4. Server already serves `client/dist` (see `server/index.js`). This makes Option B possible.

Option A — Backend: Render, Frontend: Vercel (recommended)

Backend (Render)
1. Push code to GitHub.
2. Go to https://render.com and sign in.
3. Create a new "Web Service" and connect your GitHub repo.
   - Root Directory: `server`
   - Build Command: `npm install && npm run build || echo "no server build"`
   - Start Command: `npm start` (or `node index.js`)
   - Environment: set `CLIENT_URL` to your frontend URL once you have it, or `*` for testing.
4. Deploy the service. Copy the generated public URL (e.g., `https://the-gang.onrender.com`).

Frontend (Vercel)
1. In Vercel, create a new project and connect the same GitHub repo.
2. Set Root Directory: `client`.
3. Framework Preset: Vite. Build command: `npm run build`. Output dir: `dist`.
4. Set an environment variable `VITE_SERVER_URL` to your Render backend URL (e.g., `https://the-gang.onrender.com`).
5. Deploy. Copy the Vercel URL and open it — it should connect to the backend.

Notes: If you prefer Netlify, configure similarly (build `client`, publish `client/dist`).

Option B — Single service (Render) serving both client and server

This is convenient and keeps only one URL to share.

1. In `server/index.js` the server already serves `../client/dist`.
2. In Render, create a Web Service with Root Directory: repository root or `server`.
3. Build Command (render service):
   - If deploying from repository root, use:
     ```bash
     cd client && npm install && npm run build && cd ../server && npm install
     ```
   - If deploying with `server` as root, add a pre-build step in Render: build `client` first, or use a `render-build.sh` script checked into the repo that builds client then server.
4. Start Command: `node server/index.js` or `npm start` (from the `server` folder).
5. Set any needed env vars (e.g., `CLIENT_URL` if used) in Render.
6. Deploy and copy the public URL.

Local verification before pushing

1. Build client locally:
```bash
cd client
npm install
npm run build
```
2. Install server deps and run server to serve built client:
```bash
cd ../server
npm install
npm start
# server listens on PORT (default 3001). Open http://localhost:3001
```
3. You can also run frontend dev with Vite for local testing, but when using built client, visit the server URL.

Temporary sharing for quick playtesting (no deploy)

- Use a tunneling service like `ngrok` or `localtunnel` to create a temporary public URL for your local server. Example with ngrok:
  - `ngrok http 3001` (exposes backend) and `ngrok http 5173` (exposes Vite dev) — update `VITE_SERVER_URL` to the backend tunnel URL.

Credentials and automation

- I cannot deploy to your personal Render/Vercel accounts without your credentials or GitHub access.
- If you want, I can:
  - Prepare a `render.yaml` or `Procfile` and a small `render-build.sh` script in the repo to simplify deployment.
  - Walk you through the exact clicks to connect GitHub and create services.
  - Run local build and smoke-tests here and confirm everything serves as expected.

Which provider do you want to use (Render + Vercel or Heroku + Vercel)? If you want, I can add a small `render-build.sh` and a `Procfile` to the repo to make Option B smoother.
