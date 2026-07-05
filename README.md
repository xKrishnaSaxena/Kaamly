# Kaamly

Voice-first Progressive Web App connecting blue-collar & gig workers with nearby jobs.
Tap, speak your skill or your need, and get matched on a local map — no 80 MB app install.

> **Status: Phase 0 — scaffold.** Installable PWA + FastAPI/PostGIS skeleton + data model.
> See the roadmap below for what each phase adds.

## Stack (all free / open-source)

| Layer            | Choice                                                        |
| ---------------- | ------------------------------------------------------------ |
| Frontend         | React + Vite + Tailwind v4, installable PWA (service worker) |
| Voice (later)    | Whisper / AI4Bharat IndicWhisper · Piper TTS                 |
| Calling (later)  | LiveKit (self-hosted WebRTC)                                 |
| Backend          | FastAPI (async) + SQLAlchemy 2.0                             |
| Database         | PostgreSQL + PostGIS (Supabase free tier)                    |
| Maps (later)     | MapLibre GL + OpenStreetMap                                  |
| Payments (later) | Razorpay Route (UPI escrow)                                  |

## Repo layout

```
kaamly/
├── frontend/   # Vite + React + Tailwind PWA
├── backend/    # FastAPI + async SQLAlchemy
└── db/
    └── schema.sql   # PostGIS schema — source of truth, apply to Supabase
```

## Run it

### 1. Database (Supabase — free)
1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, paste and run [`db/schema.sql`](db/schema.sql).
3. Grab the connection string (Project Settings → Database) — the `postgresql://…` URL.

### 2. Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set DATABASE_URL to your Supabase async URL
uvicorn app.main:app --reload # -> http://localhost:8000
```
- `GET /health` — liveness (the PWA pings this).
- `GET /health/db` — checks DB connectivity + that PostGIS is enabled.

> The backend runs even without a database configured; `/health` stays green and
> `/health/db` reports what's missing. Wire up Supabase whenever you're ready.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                   # -> http://localhost:5173
```
Optional: create `frontend/.env` with `VITE_API_URL=http://localhost:8000` (this is
the default). Brand PWA icons are auto-generated into `public/` before dev/build by
`scripts/gen-icons.mjs` (pure Node, no dependencies).

To verify the PWA install path: `npm run build && npm run preview`, open in Chrome,
and use the "Add to home screen" prompt.

## Roadmap
- **Phase 0 — Foundations (here):** installable PWA, DB schema, API skeleton.
- **Phase 1 — Text-first core loop:** availability toggle, post a job, PostGIS radius match.
- **Phase 2 — Voice-first input:** push-to-talk → STT → LLM intent extraction → TTS confirm.
- **Phase 3 — Maps + realtime:** MapLibre job cards, web-push notifications, live updates.
- **Phase 4 — Masked calling:** LiveKit audio rooms, no phone numbers shared.
- **Phase 5 — Payments & escrow:** Razorpay Route, UPI payout on completion.
- **Phase 6 — Trust & scale:** ratings, KYC, self-hosted STT, SMS/IVR fallback.
