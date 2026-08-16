# Deployment guide — The Gang

## Primary deployment: one Render web service

The canonical deployment uses the repository root as Render’s Root Directory and serves the built client from the Express server.

Render configuration:

- Root Directory: repository root
- Environment: Node
- Build Command: `bash ./render-build.sh`
- Start Command: `npm start`

Production flow:

```text
GitHub repository root
  → npm ci --include=dev
  → npm run build --workspace client
  → npm start
  → server/index.js starts Express and Socket.IO
  → Express serves client/dist
```

`render-build.sh` installs the root npm workspace dependencies and builds the Vite client. The root `start` script runs `node server/index.js`. The server listens on Render’s `PORT`, serves `/health`, serves the generated `client/dist`, and hosts Socket.IO on the same HTTP service.

Set `CLIENT_URL` to the frontend origin when using a separate frontend. The current single-service setup may use the value supplied in `render.yaml`.

## Optional deployment: Render backend and Vercel frontend

This is a separate deployment model and is not the primary configuration above.

Backend:

- Deploy the backend from the repository root so the client build and root workspace lockfile remain available.
- Build with `bash ./render-build.sh`, or otherwise build `client` before starting the server.
- Start with `npm start`.
- Set `CLIENT_URL` to the Vercel frontend URL.

Frontend:

- Vercel Root Directory: `client`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_SERVER_URL` to the Render backend URL.

## Local verification

From the repository root:

```bash
npm ci --include=dev
npm run build --workspace client
npm start
```

The server uses `PORT` when provided and defaults to `3001` locally. Check `http://localhost:3001/health` and expect `{ "ok": true }`.

Existing tests can be run with:

```bash
node --test server/src/chipRoundRules.test.mjs server/src/gameEngine.challenge.test.mjs client/src/components/GameTable.challengeVote.test.mjs
```
