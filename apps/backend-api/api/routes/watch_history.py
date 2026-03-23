"""
Watch history endpoints
"""

from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.auth import get_current_active_user
from core.database import get_db
from models.user import User
from models.watch_history import WatchHistory
from schemas.watch_history import WatchHistory as WatchHistorySchema, WatchHistoryCreate, WatchHistoryUpdate, ContinueWatching

router = APIRouter()


@router.get("/", response_model=List[WatchHistorySchema])
async def get_watch_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's watch history"""
    offset = (page - 1) * per_page
    
    result = await db.execute(
        select(WatchHistory)
        .where(WatchHistory.user_id == current_user.id)
        .order_by(desc(WatchHistory.watched_at))
        .offset(offset)
        .limit(per_page)
    )
    
    history = result.scalars().all()
    return history


@router.get("/continue-watching", response_model=List[ContinueWatching])
async def get_continue_watching(
    limit: int = Query(10, ge=1, le=20),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get continue watching list (in-progress movies)"""
    from services.tmdb import tmdb_service
    
    # Get watch history entries that are not completed and have progress
    result = await db.execute(
        select(WatchHistory)
        .where(
            WatchHistory.user_id == current_user.id,
            WatchHistory.is_completed == 0,
            WatchHistory.progress_seconds > 0
        )
        .order_by(desc(WatchHistory.updated_at))
        .limit(limit)
    )
    
    entries = result.scalars().all()
    
    continue_watching = []
    for entry in entries:
        # Get movie details from TMDB
        movie = await tmdb_service.get_movie_list_item(entry.movie_id)
        if movie:
            continue_watching.append(ContinueWatching(
                movie=movie,
                progress_seconds=entry.progress_seconds,
                duration_seconds=entry.duration_seconds,
                progress_percent=entry.progress_percent,
                last_watched_at=entry.updated_at
            ))
    
    return continue_watching


@router.post("/", response_model=WatchHistorySchema, status_code=status.HTTP_201_CREATED)
async def add_watch_history(
    data: WatchHistoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Add or update watch history entry"""
    # Check if entry exists
    result = await db.execute(
        select(WatchHistory).where(
            WatchHistory.user_id == current_user.id,
            WatchHistory.movie_id == data.movie_id
        )
    )
    entry = result.scalar_one_or_none()
    
    if entry:
        # Update existing entry
        entry.progress_seconds = data.progress_seconds
        entry.duration_seconds = data.duration_seconds
        entry.progress_percent = data.progress_percent
        entry.is_completed = 1 if data.is_completed else 0
        entry.updated_at = datetime.utcnow()
    else:
        # Create new entry
        entry = WatchHistory(
            user_id=current_user.id,
            movie_id=data.movie_id,
            progress_seconds=data.progress_seconds,
            duration_seconds=data.duration_seconds,
            progress_percent=data.progress_percent,
            is_completed=1 if data.is_completed else 0
        )
        db.add(entry)
    
    await db.commit()
    await db.refresh(entry)
    
    return entry


@router.put("/{movie_id}", response_model=WatchHistorySchema)
async def update_watch_progress(
    movie_id: int,
    data: WatchHistoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update watch progress for a movie"""
    result = await db.execute(
        select(WatchHistory).where(
            WatchHistory.user_id == current_user.id,
            WatchHistory.movie_id == movie_id
        )
    )
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch history entry not found"
        )
    
    entry.progress_seconds = data.progress_seconds
    entry.duration_seconds = data.duration_seconds or entry.duration_seconds
    entry.progress_percent = data.progress_percent
    entry.is_completed = 1 if data.is_completed else 0
    entry.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(entry)
    
    return entry


@router.delete("/{movie_id}")
async def delete_watch_history(
    movie_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete watch history entry"""
    result = await db.execute(
        select(WatchHistory).where(
            WatchHistory.user_id == current_user.id,
            WatchHistory.movie_id == movie_id
        )
    )
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch history entry not found"
        )
    
    await db.delete(entry)
    await db.commit()
    
    return {"success": True, "message": "Watch history deleted"}


@router.delete("/")
async def clear_watch_history(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Clear all watch history"""
    await db.execute(
        WatchHistory.__table__.delete().where(
            WatchHistory.user_id == current_user.id
        )
    )
    await db.commit()
    
    return {"success": True, "message": "Watch history cleared"}
