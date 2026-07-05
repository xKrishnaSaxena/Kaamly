import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..geo import point
from ..models import User, WorkerProfile
from ..schemas import AvailabilityUpdate, MatchOut, WorkerCreate, WorkerOut
from ..services import find_workers, go_online, parse_uuid, worker_coords

router = APIRouter()


def _worker_out(user, wp, lat, lng) -> WorkerOut:
    return WorkerOut(
        user_id=str(user.id),
        name=user.name,
        phone=user.phone,
        skills=list(wp.skills or []),
        is_available=wp.is_available,
        available_until=wp.available_until,
        lat=lat,
        lng=lng,
        rating_avg=float(wp.rating_avg or 0),
        rating_count=int(wp.rating_count or 0),
    )


@router.post("", response_model=WorkerOut, status_code=201)
async def register_worker(body: WorkerCreate, session: AsyncSession = Depends(get_session)):
    """Worker goes online: create/update their profile + availability."""
    user, wp, _ = await go_online(session, body)
    await session.commit()
    return _worker_out(user, wp, body.lat, body.lng)


@router.get("/nearby", response_model=List[MatchOut])
async def workers_nearby(
    lat: float,
    lng: float,
    radius_m: int = 3000,
    skill: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    return await find_workers(session, lat, lng, radius_m, skill=skill, limit=20)


@router.patch("/{user_id}/availability", response_model=WorkerOut)
async def set_availability(
    user_id: str,
    body: AvailabilityUpdate,
    session: AsyncSession = Depends(get_session),
):
    uid = parse_uuid(user_id)
    user = (await session.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    wp = (
        await session.execute(select(WorkerProfile).where(WorkerProfile.user_id == uid))
    ).scalar_one_or_none()
    if user is None or wp is None:
        raise HTTPException(status_code=404, detail="worker not found")

    wp.is_available = body.is_available
    if body.lat is not None and body.lng is not None:
        wp.location = point(body.lat, body.lng)
    if body.available_hours is not None:
        wp.available_until = datetime.datetime.now(
            datetime.timezone.utc
        ) + datetime.timedelta(hours=body.available_hours)
    await session.flush()

    if body.lat is not None and body.lng is not None:
        lat, lng = body.lat, body.lng
    else:
        lat, lng = await worker_coords(session, wp.id)
    await session.commit()
    return _worker_out(user, wp, lat, lng)
