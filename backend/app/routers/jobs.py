from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..geo import point
from ..models import Job, Match, User
from ..schemas import (
    AcceptRequest,
    JobCreate,
    JobNearby,
    JobOut,
    JobWithMatches,
    MatchOut,
)
from ..services import find_jobs, find_workers, get_or_create_user, parse_uuid

router = APIRouter()

DEFAULT_RADIUS_M = 3000


def _job_out(job: Job, lat: float, lng: float) -> JobOut:
    return JobOut(
        id=str(job.id),
        category=job.category,
        title=job.title,
        description=job.description,
        lat=lat,
        lng=lng,
        urgency=job.urgency,
        status=job.status,
        budget_amount=float(job.budget_amount) if job.budget_amount is not None else None,
        created_at=job.created_at,
    )


@router.post("", response_model=JobWithMatches, status_code=201)
async def create_job(body: JobCreate, session: AsyncSession = Depends(get_session)):
    """Consumer posts a job; we return it with the nearest available matches."""
    user = await get_or_create_user(session, body.phone, body.name, "consumer")
    job = Job(
        consumer_id=user.id,
        category=body.category,
        title=body.title,
        description=body.description,
        location=point(body.lat, body.lng),
        urgency=body.urgency,
        budget_amount=body.budget_amount,
    )
    session.add(job)
    await session.flush()
    await session.refresh(job)  # load server defaults (status, created_at)

    matches = await find_workers(
        session, body.lat, body.lng, DEFAULT_RADIUS_M, skill=body.category, limit=3
    )
    out = JobWithMatches(job=_job_out(job, body.lat, body.lng), matches=matches)
    await session.commit()
    return out


@router.get("/nearby", response_model=List[JobNearby])
async def jobs_nearby(
    lat: float,
    lng: float,
    radius_m: int = 5000,
    category: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    """Worker view: open jobs near me, nearest first."""
    return await find_jobs(session, lat, lng, radius_m, category=category, limit=20)


async def _job_coords(session: AsyncSession, job_id):
    return (
        await session.execute(
            text(
                "select category, status, "
                "st_y(location::geometry) as lat, st_x(location::geometry) as lng "
                "from jobs where id = :id"
            ),
            {"id": str(job_id)},
        )
    ).first()


@router.get("/{job_id}/matches", response_model=List[MatchOut])
async def job_matches(
    job_id: str,
    radius_m: int = DEFAULT_RADIUS_M,
    session: AsyncSession = Depends(get_session),
):
    row = await _job_coords(session, parse_uuid(job_id))
    if row is None:
        raise HTTPException(status_code=404, detail="job not found")
    return await find_workers(
        session, float(row.lat), float(row.lng), radius_m, skill=row.category, limit=3
    )


@router.post("/{job_id}/accept")
async def accept_job(
    job_id: str,
    body: AcceptRequest,
    session: AsyncSession = Depends(get_session),
):
    """Worker accepts an offered job — records the match, marks the job matched."""
    jid = parse_uuid(job_id)
    job = (await session.execute(select(Job).where(Job.id == jid))).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    worker = (
        await session.execute(select(User).where(User.phone == body.worker_phone))
    ).scalar_one_or_none()
    if worker is None:
        raise HTTPException(status_code=404, detail="worker not found")

    existing = (
        await session.execute(
            select(Match).where(Match.job_id == jid, Match.worker_id == worker.id)
        )
    ).scalar_one_or_none()
    if existing is None:
        session.add(Match(job_id=jid, worker_id=worker.id, status="accepted"))
    else:
        existing.status = "accepted"
    job.status = "matched"
    await session.commit()
    return {"status": "accepted", "job_id": str(jid), "worker_id": str(worker.id)}


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: str, session: AsyncSession = Depends(get_session)):
    jid = parse_uuid(job_id)
    job = (await session.execute(select(Job).where(Job.id == jid))).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    row = await _job_coords(session, jid)
    return _job_out(job, float(row.lat), float(row.lng))
