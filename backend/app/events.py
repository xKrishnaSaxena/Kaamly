"""In-memory realtime hub (SSE fan-out).

Workers subscribe with their location + skills and receive `job.created` events
for nearby matching jobs; consumers subscribe by phone and receive `job.accepted`
events for their jobs. Single-process only — for horizontal scale, back this with
Redis pub/sub (a later concern).
"""
import asyncio
import math
from typing import List, Optional


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class Subscriber:
    def __init__(self, kind: str, **attrs):
        self.kind = kind
        self.attrs = attrs
        self.queue: asyncio.Queue = asyncio.Queue()


class Hub:
    def __init__(self) -> None:
        self._subs: set = set()

    def subscribe(self, sub: Subscriber) -> Subscriber:
        self._subs.add(sub)
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        self._subs.discard(sub)

    async def publish_job_created(self, job: dict) -> None:
        """job: {id, category, title, description, lat, lng, urgency}."""
        for s in list(self._subs):
            if s.kind != "worker":
                continue
            skills: List[str] = s.attrs.get("skills", [])
            if job["category"] not in skills:
                continue
            dist = haversine_m(s.attrs["lat"], s.attrs["lng"], job["lat"], job["lng"])
            if dist > s.attrs.get("radius", 5000):
                continue
            await s.queue.put({"type": "job", "distance_m": round(dist, 1), **job})

    async def publish_job_accepted(self, consumer_phone: Optional[str], payload: dict) -> None:
        if not consumer_phone:
            return
        for s in list(self._subs):
            if s.kind == "consumer" and s.attrs.get("phone") == consumer_phone:
                await s.queue.put({"type": "accepted", **payload})

    async def publish_job_removed(self, job_id: str) -> None:
        """Tell all workers a job is gone (accepted, cancelled, or superseded)."""
        for s in list(self._subs):
            if s.kind == "worker":
                await s.queue.put({"type": "job_removed", "id": job_id})

    async def publish_worker_available(self, consumer_phone: Optional[str], payload: dict) -> None:
        """Tell a waiting consumer that a matching worker just came online."""
        if not consumer_phone:
            return
        for s in list(self._subs):
            if s.kind == "consumer" and s.attrs.get("phone") == consumer_phone:
                await s.queue.put({"type": "worker_available", **payload})


hub = Hub()
