# Inspectra

Quality management UI (Vite + React) backed by **MongoDB** via a local **Express API** in `server/`.

There is **no Supabase** in this stack: data, file storage (GridFS), document processing, and the AI assistant all go through MongoDB and `server/index.js`.

## Prerequisites

- Node 20+
- MongoDB Atlas URI (or local MongoDB)

## Configuration

Create `.env.local` in the project root (used by the API server):

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string (required) |
| `MONGODB_DB_NAME` | Database name (default: `inspectra`) |
| `GEMINI_API_KEY` | Google AI — powers `/api/assistant` and document RAG in `server/rag.js` |
| `GEMINI_MODEL` | Optional model id (default: `gemini-2.5-flash`) |
| `PORT` | API port (default: `3001`) |

Frontend (optional; Vite proxies `/api` to the server in dev):

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Set only if the API is on another origin; leave empty locally so requests use `/api` and the Vite proxy |
| `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE` | Auth0 (required for protected routes) |

## Run locally

Terminal 1 — API:

```bash
npm install
npm run server
```

Terminal 2 — UI:

```bash
npm run dev
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). The dev server proxies `/api` → `http://127.0.0.1:3001`.

## Build UI

```bash
npm run build
npm run preview
```

Serve the static `dist/` behind your host of choice and point `VITE_API_BASE_URL` (at build time) to your deployed API URL.

## Data model

Collections mirror the former Postgres tables: `suppliers`, `parts`, `lots`, `devices`, `device_lots`, `inspections`, `ncrs`, `capas`, `documents`, plus GridFS bucket `documents` for file bytes. See `server/qms.js` and `server/rag.js` for shapes and behavior.
