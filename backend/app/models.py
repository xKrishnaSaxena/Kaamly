"""SQLAlchemy models for Kaamly.

These mirror db/schema.sql (which is the source of truth applied to Supabase).
Kept in sync so the API layer has typed access to the same tables.
"""
from __future__ import annotations

import datetime
import uuid
from typing import Optional

from geoalchemy2 import Geography
from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _uuid_pk()
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(16), default="worker", nullable=False)
    preferred_lang: Mapped[str] = mapped_column(String(8), default="hi", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    worker_profile: Mapped[Optional["WorkerProfile"]] = relationship(
        back_populates="user", uselist=False
    )

    __table_args__ = (
        CheckConstraint("role in ('worker','consumer','both')", name="users_role_chk"),
    )


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    skills: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    bio: Mapped[Optional[str]] = mapped_column(Text)
    location = mapped_column(Geography(geometry_type="POINT", srid=4326))
    available_until: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True)
    )
    is_available: Mapped[bool] = mapped_column(default=False)
    rating_avg: Mapped[float] = mapped_column(Numeric(3, 2), default=0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)

    user: Mapped["User"] = relationship(back_populates="worker_profile")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    consumer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(48), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(160))
    description: Mapped[Optional[str]] = mapped_column(Text)
    location = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    urgency: Mapped[str] = mapped_column(String(16), default="scheduled", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="open", nullable=False)
    budget_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("urgency in ('urgent','scheduled')", name="jobs_urgency_chk"),
        CheckConstraint(
            "status in ('open','matched','in_progress','done','cancelled')",
            name="jobs_status_chk",
        ),
    )


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = _uuid_pk()
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), default="offered", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "status in ('offered','accepted','declined','expired')",
            name="matches_status_chk",
        ),
    )


class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[uuid.UUID] = _uuid_pk()
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    rater_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    ratee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("stars between 1 and 5", name="ratings_stars_chk"),
    )
