import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ..events import Subscriber, hub

router = APIRouter()

HEARTBEAT_SECS = 20


async def _stream(sub: Subscriber, request: Request):
    try:
        yield ": connected\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                evt = await asyncio.wait_for(sub.queue.get(), timeout=HEARTBEAT_SECS)
                yield f"data: {json.dumps(evt)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"  # keep the connection alive
    finally:
        hub.unsubscribe(sub)


_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


@router.get("/worker")
async def worker_events(
    request: Request, lat: float, lng: float, skills: str, radius_m: int = 5000
):
    """Live stream of nearby matching jobs for an online worker."""
    sub = Subscriber(
        "worker",
        lat=lat,
        lng=lng,
        skills=[s for s in skills.split(",") if s],
        radius=radius_m,
    )
    hub.subscribe(sub)
    return StreamingResponse(
        _stream(sub, request), media_type="text/event-stream", headers=_SSE_HEADERS
    )


@router.get("/consumer")
async def consumer_events(request: Request, phone: str):
    """Live stream of acceptance updates for a consumer's jobs."""
    sub = Subscriber("consumer", phone=phone)
    hub.subscribe(sub)
    return StreamingResponse(
        _stream(sub, request), media_type="text/event-stream", headers=_SSE_HEADERS
    )
