# Kaamly

Voice-first Progressive Web App connecting blue-collar & gig workers with nearby jobs.
Tap, speak your skill or your need, and get matched on a local map — no 80 MB app install.

> **Status: Phase 2 — voice-first input working.** Everything in Phase 1, plus a
> push-to-talk mic on both screens: speak in Hindi/English → speech-to-text →
> intent extraction → the form prefills and speaks a confirmation back.
> See the roadmap below for what each phase adds.

### Voice pipeline (Phase 2)
- **STT:** Groq Whisper if `GROQ_API_KEY` is set, else the browser's built-in
  speech recognition (Chrome/Android).
- **Intent:** Groq LLM if a key is set, else a free rule-based keyword parser that
  handles romanized-Hindi + English (`backend/app/voice.py`).
- **TTS confirm:** on-device `speechSynthesis` (swap for Piper later).
- Endpoints: `GET /api/voice/config`, `POST /api/voice/transcribe`, `POST /api/voice/parse`.

**It works with zero API keys** (browser STT + rule parser). Add a free Groq key to
`backend/.env` for robust vernacular accuracy.

## API (Phase 1)

| Method & path | Purpose |
| --- | --- |
| `POST /api/workers` | Worker goes online (skills, location, hours) |
| `PATCH /api/workers/{user_id}/availability` | Toggle availability / update location |
| `GET /api/workers/nearby` | Browse available workers in a radius |
| `POST /api/jobs` | Post a job → returns the job + 3 nearest matches |
| `GET /api/jobs/nearby` | Worker view: open jobs near me |
| `GET /api/jobs/{job_id}/matches` | Re-run the match for a job |
| `POST /api/jobs/{job_id}/accept` | Worker accepts → records match, marks job matched |

Matching lives in `backend/app/services.py` (`ST_DWithin` + `ST_Distance`, skill-filtered,
nearest-first). Interactive API docs at `http://localhost:8000/docs`.

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
- **Phase 0 — Foundations ✅:** installable PWA, DB schema, API skeleton, RLS lockdown.
- **Phase 1 — Text-first core loop ✅:** availability toggle, post a job, PostGIS radius match.
- **Phase 2 — Voice-first input ✅:** push-to-talk → STT → intent extraction → prefill + TTS confirm.
- **Phase 3 — Maps + realtime (next):** MapLibre job cards, web-push notifications, live updates.
- **Phase 4 — Masked calling:** LiveKit audio rooms, no phone numbers shared.
- **Phase 5 — Payments & escrow:** Razorpay Route, UPI payout on completion.
- **Phase 6 — Trust & scale:** ratings, KYC, self-hosted STT, SMS/IVR fallback.
