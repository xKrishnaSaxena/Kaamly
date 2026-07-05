from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import settings
from .db import engine
from .routers import events, jobs, voice, workers

# Import models so their tables are registered on Base.metadata.
from . import models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="Kaamly API", version="0.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workers.router, prefix="/api/workers", tags=["workers"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
app.include_router(events.router, prefix="/api/events", tags=["events"])


@app.get("/")
async def root():
    return {"name": "Kaamly API", "status": "ok", "env": settings.app_env}


@app.get("/health")
async def health():
    """Liveness check — the PWA pings this to show API connectivity."""
    return {"status": "ok"}


@app.get("/health/db")
async def health_db():
    """Readiness check — verifies DB connectivity and the PostGIS extension."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("select 1"))
            has_postgis = (
                await conn.execute(
                    text("select exists(select 1 from pg_extension where extname='postgis')")
                )
            ).scalar()
        return {"status": "ok", "postgis": bool(has_postgis)}
    except Exception as exc:  # pragma: no cover - depends on external DB
        return JSONResponse(
            status_code=503, content={"status": "down", "error": str(exc)}
        )
