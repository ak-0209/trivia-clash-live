# Trivia Clash - Server


This is a minimal TypeScript Express server used for local development and demoing lobby state.

Run locally:

```bash
cd server
npm install
npm run dev
```

The server listens on port 3000 by default and exposes these endpoints (suitable for polling):

- `GET /health` — returns { status: 'ok' }
- `GET /lobby` — returns current lobby state { players, countdown }
- `POST /start` — sets countdown to 0 and returns `{ ok: true, startAt }`

Note: WebSocket/socket server was removed per request. You can add it later if you want real-time pushes.
