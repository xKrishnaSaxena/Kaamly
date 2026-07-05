"""Data-access + matching logic for the Phase 1 core loop."""
import datetime
import uuid
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .geo import point
from .models import Job, User, WorkerProfile
from .schemas import JobNearby, MatchOut, WorkerCreate


def parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="invalid id")


async def get_or_create_user(
    session: AsyncSession, phone: str, name: Optional[str], role: str
) -> User:
    """Phase 1 has no auth yet — identify a user by phone, create on first sight."""
    user = (
        await session.execute(select(User).where(User.phone == phone))
    ).scalar_one_or_none()
    if user is None:
        user = User(phone=phone, name=name, role=role)
        session.add(user)
        await session.flush()
        return user
    if name and not user.name:
        user.name = name
    if user.role != role and user.role != "both":
        user.role = "both"  # someone who both hires and works
    return user


async def go_online(session: AsyncSession, data: WorkerCreate):
    """Create/update a worker profile and mark them available."""
    user = await get_or_create_user(session, data.phone, data.name, "worker")
    wp = (
        await session.execute(
            select(WorkerProfile).where(WorkerProfile.user_id == user.id)
        )
    ).scalar_one_or_none()
    until = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        hours=data.available_hours
    )
    if wp is None:
        wp = WorkerProfile(user_id=user.id)
        session.add(wp)
    wp.skills = data.skills
    wp.bio = data.bio
    wp.location = point(data.lat, data.lng)
    wp.available_until = until
    wp.is_available = True
    await session.flush()
    return user, wp, until


async def worker_coords(session: AsyncSession, profile_id) -> tuple:
    row = (
        await session.execute(
            text(
                "select st_y(location::geometry) as lat, "
                "st_x(location::geometry) as lng "
                "from worker_profiles where id = :id"
            ),
            {"id": str(profile_id)},
        )
    ).first()
    if row is None or row.lat is None:
        return (None, None)
    return (float(row.lat), float(row.lng))


# --- the core PostGIS radius match -----------------------------------------
_WORKERS_SQL = """
select u.id::text as user_id, u.name, u.phone, wp.skills,
       wp.rating_avg, wp.rating_count,
       st_y(wp.location::geometry) as lat,
       st_x(wp.location::geometry) as lng,
       st_distance(wp.location, st_setsrid(st_point(:lng, :lat), 4326)::geography)
           as distance_m
from worker_profiles wp
join users u on u.id = wp.user_id
where wp.is_available
  and (wp.available_until is null or wp.available_until > now())
  and st_dwithin(wp.location, st_setsrid(st_point(:lng, :lat), 4326)::geography,
                 :radius_m)
  {skill_clause}
order by distance_m
limit :limit
"""


async def find_workers(
    session: AsyncSession,
    lat: float,
    lng: float,
    radius_m: int,
    skill: Optional[str] = None,
    limit: int = 3,
) -> List[MatchOut]:
    params = {"lat": lat, "lng": lng, "radius_m": radius_m, "limit": limit}
    skill_clause = ""
    if skill:
        skill_clause = "and :skill = any(wp.skills)"
        params["skill"] = skill
    sql = _WORKERS_SQL.format(skill_clause=skill_clause)
    rows = (await session.execute(text(sql), params)).mappings().all()
    return [
        MatchOut(
            user_id=r["user_id"],
            name=r["name"],
            phone=r["phone"],
            skills=list(r["skills"] or []),
            rating_avg=float(r["rating_avg"] or 0),
            rating_count=int(r["rating_count"] or 0),
            distance_m=round(float(r["distance_m"]), 1),
            lat=float(r["lat"]),
            lng=float(r["lng"]),
        )
        for r in rows
    ]


_OPEN_JOBS_FOR_WORKER_SQL = """
select j.id::text as job_id, j.category, j.title, u.phone as consumer_phone,
       st_distance(j.location, st_setsrid(st_point(:lng, :lat), 4326)::geography)
           as distance_m
from jobs j
join users u on u.id = j.consumer_id
where j.status = 'open'
  and j.category = any(:skills)
  and st_dwithin(j.location, st_setsrid(st_point(:lng, :lat), 4326)::geography,
                 :radius_m)
"""


async def open_jobs_for_worker(
    session: AsyncSession,
    lat: float,
    lng: float,
    skills: List[str],
    radius_m: int,
) -> List[dict]:
    """Open jobs (with their consumer's phone) that a newly-online worker matches."""
    if not skills:
        return []
    rows = (
        await session.execute(
            text(_OPEN_JOBS_FOR_WORKER_SQL),
            {"lat": lat, "lng": lng, "skills": skills, "radius_m": radius_m},
        )
    ).mappings().all()
    return [
        {
            "job_id": r["job_id"],
            "category": r["category"],
            "title": r["title"],
            "consumer_phone": r["consumer_phone"],
            "distance_m": round(float(r["distance_m"]), 1),
        }
        for r in rows
    ]


_JOBS_SQL = """
select j.id::text as id, j.category, j.title, j.description,
       st_y(j.location::geometry) as lat,
       st_x(j.location::geometry) as lng,
       j.urgency, j.status, j.budget_amount, j.created_at,
       st_distance(j.location, st_setsrid(st_point(:lng, :lat), 4326)::geography)
           as distance_m
from jobs j
where j.status = 'open'
  and st_dwithin(j.location, st_setsrid(st_point(:lng, :lat), 4326)::geography,
                 :radius_m)
  {cat_clause}
order by distance_m
limit :limit
"""


async def find_jobs(
    session: AsyncSession,
    lat: float,
    lng: float,
    radius_m: int,
    category: Optional[str] = None,
    limit: int = 20,
) -> List[JobNearby]:
    params = {"lat": lat, "lng": lng, "radius_m": radius_m, "limit": limit}
    cat_clause = ""
    if category:
        cat_clause = "and j.category = :category"
        params["category"] = category
    sql = _JOBS_SQL.format(cat_clause=cat_clause)
    rows = (await session.execute(text(sql), params)).mappings().all()
    return [
        JobNearby(
            id=r["id"],
            category=r["category"],
            title=r["title"],
            description=r["description"],
            lat=float(r["lat"]),
            lng=float(r["lng"]),
            urgency=r["urgency"],
            status=r["status"],
            budget_amount=float(r["budget_amount"])
            if r["budget_amount"] is not None
            else None,
            created_at=r["created_at"],
            distance_m=round(float(r["distance_m"]), 1),
        )
        for r in rows
    ]
