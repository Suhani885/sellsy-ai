"""
SQLAlchemy engine, session factory, and declarative base.

Every model in app/models/ inherits from Base defined here, and alembic's
env.py imports Base.metadata from this module to autogenerate migrations.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config.settings import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


class Base(DeclarativeBase):
    pass
