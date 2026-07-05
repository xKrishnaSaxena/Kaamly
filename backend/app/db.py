from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import settings

engine = create_async_engine(
    settings.sqlalchemy_url,
    pool_pre_ping=True,
    future=True,
    connect_args=settings.db_connect_args,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_session():
    """FastAPI dependency that yields a request-scoped async DB session."""
    async with SessionLocal() as session:
        yield session
