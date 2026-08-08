# AzmainBd Commerce — Server

Express + MongoDB API server backing the [AzmainBd Commerce client](https://github.com/mehedipolash/azmainBd).

## Tech stack

- **Express 5** — HTTP server and routing
- **MongoDB (Atlas)** — data store, via the official `mongodb` driver
- **CORS** — cross-origin access for the Vite client
- **dotenv** — environment variable loading

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env   # then fill in your real values
npm run dev
```

The server starts on `http://localhost:5000` by default.

## Environment variables

Copy `.env.example` to `.env` and fill in real values. The `.env` file is
git-ignored and must never be committed.

| Variable  | Description                              |
| --------- | ---------------------------------------- |
| `DB_USER` | MongoDB Atlas database user              |
| `DB_PASS` | MongoDB Atlas database password          |
| `PORT`    | Port to listen on (defaults to `5000`)   |

## Scripts

| Command         | Description                                   |
| --------------- | --------------------------------------------- |
| `npm start`     | Run the server                                |
| `npm run dev`   | Run with auto-restart on file changes         |

## API

| Method | Endpoint   | Description                    |
| ------ | ---------- | ------------------------------ |
| `GET`  | `/`        | Health check                   |
| `GET`  | `/parcels` | List all parcels               |

## Connecting the client

The client reads its backend URL from `VITE_API_BASE_URL` in its `.env.local`.
For local development this should match the port above:

```
VITE_API_BASE_URL=http://localhost:5000
```

When deploying, point that variable at the deployed server URL.
