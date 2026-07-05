"""Pydantic request/response models for the Phase 1 core loop."""
import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

Lat = Field(ge=-90, le=90)
Lng = Field(ge=-180, le=180)


# --- workers ---------------------------------------------------------------
class WorkerCreate(BaseModel):
    phone: str = Field(min_length=4, max_length=20)
    name: Optional[str] = None
    skills: List[str] = Field(min_length=1)
    lat: float = Lat
    lng: float = Lng
    bio: Optional[str] = None
    available_hours: float = Field(default=4, gt=0, le=24)


class AvailabilityUpdate(BaseModel):
    is_available: bool
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    available_hours: Optional[float] = Field(default=None, gt=0, le=24)


class WorkerOut(BaseModel):
    user_id: str
    name: Optional[str]
    phone: str
    skills: List[str]
    is_available: bool
    available_until: Optional[datetime.datetime]
    lat: Optional[float]
    lng: Optional[float]
    rating_avg: float
    rating_count: int


# --- jobs ------------------------------------------------------------------
class JobCreate(BaseModel):
    phone: str = Field(min_length=4, max_length=20)
    name: Optional[str] = None
    category: str = Field(min_length=1, max_length=48)
    title: Optional[str] = None
    description: Optional[str] = None
    lat: float = Lat
    lng: float = Lng
    urgency: str = Field(default="urgent", pattern="^(urgent|scheduled)$")
    budget_amount: Optional[float] = Field(default=None, ge=0)


class JobOut(BaseModel):
    id: str
    category: str
    title: Optional[str]
    description: Optional[str]
    lat: float
    lng: float
    urgency: str
    status: str
    budget_amount: Optional[float]
    created_at: datetime.datetime


class JobNearby(JobOut):
    distance_m: float


# --- matching --------------------------------------------------------------
class MatchOut(BaseModel):
    user_id: str
    name: Optional[str]
    phone: str
    skills: List[str]
    rating_avg: float
    rating_count: int
    distance_m: float
    lat: float
    lng: float


class JobWithMatches(BaseModel):
    job: JobOut
    matches: List[MatchOut]


class AcceptRequest(BaseModel):
    worker_phone: str = Field(min_length=4, max_length=20)
