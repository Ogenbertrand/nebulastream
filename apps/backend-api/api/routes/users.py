"""
User endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from api.routes.auth import get_current_active_user
from core.database import get_db
from models.favorite import Favorite
from models.movie import Movie
from models.user import User
from models.watch_history import WatchHistory
from schemas.user import User as UserSchema, UserUpdate, UserProfile
from services.tmdb import tmdb_service

router = APIRouter()


@router.get("/profile", response_model=UserProfile)
async def get_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user profile with stats"""
    # Get watch count
    watch_result = await db.execute(
        select(func.count(WatchHistory.id)).where(WatchHistory.user_id == current_user.id)
    )
    watch_count = watch_result.scalar() or 0
    
    # Get favorite count
    fav_result = await db.execute(
        select(func.count(Favorite.id)).where(Favorite.user_id == current_user.id)
    )
    favorite_count = fav_result.scalar() or 0
    
    # Get total watch time
    time_result = await db.execute(
        select(func.sum(WatchHistory.progress_seconds))
        .where(WatchHistory.user_id == current_user.id)
    )
    total_seconds = time_result.scalar() or 0
    total_minutes = total_seconds // 60
    
    return UserProfile(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        display_name=current_user.display_name,
        avatar_url=current_user.avatar_url,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        last_login=current_user.last_login,
        watch_count=watch_count,
        favorite_count=favorite_count,
        total_watch_time=total_minutes
    )


@router.put("/profile", response_model=UserSchema)
async def update_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile"""
    if update_data.display_name is not None:
        current_user.display_name = update_data.display_name
    
    if update_data.avatar_url is not None:
        current_user.avatar_url = update_data.avatar_url
    
    await db.commit()
    await db.refresh(current_user)
    
    return current_user


@router.get("/favorites")
async def get_favorites(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's favorite movies"""
    result = await db.execute(
        select(Favorite, Movie)
        .join(Movie, Favorite.movie_id == Movie.id)
        .where(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
    )
    rows = result.all()

    return {
        "favorites": [
            {
                "movie_id": movie.tmdb_id or movie.id,
                "added_at": fav.created_at,
                "movie": {
                    "id": movie.tmdb_id or movie.id,
                    "title": movie.title,
                    "poster_path": movie.poster_path,
                    "backdrop_path": movie.backdrop_path,
                    "vote_average": movie.vote_average,
                    "release_date": movie.release_date,
                    "genre_ids": [],
                },
            }
            for fav, movie in rows
        ]
    }


@router.post("/favorites/{movie_id}")
async def add_favorite(
    movie_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Add movie to favorites"""
    # Frontend uses TMDB ids. Resolve/create a local Movie row first.
    movie_result = await db.execute(select(Movie).where(Movie.tmdb_id == movie_id))
    db_movie = movie_result.scalar_one_or_none()
    if not db_movie:
        # Prefer minimal metadata for speed; fallback to full detail when necessary.
        tmdb_min = await tmdb_service.get_movie_list_item(movie_id)
        tmdb_movie = None
        if not tmdb_min:
            tmdb_movie = await tmdb_service.get_movie_detail(movie_id)
            if not tmdb_movie:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Movie not found",
                )

        db_movie = Movie(
            tmdb_id=(tmdb_movie.id if tmdb_movie else tmdb_min.id),
            imdb_id=(tmdb_movie.imdb_id if tmdb_movie else None),
            title=(tmdb_movie.title if tmdb_movie else tmdb_min.title),
            original_title=(tmdb_movie.original_title if tmdb_movie else None),
            overview=(tmdb_movie.overview if tmdb_movie else None),
            tagline=(tmdb_movie.tagline if tmdb_movie else None),
            poster_path=(tmdb_movie.poster_path if tmdb_movie else tmdb_min.poster_path),
            backdrop_path=(tmdb_movie.backdrop_path if tmdb_movie else tmdb_min.backdrop_path),
            release_date=(tmdb_movie.release_date if tmdb_movie else tmdb_min.release_date),
            runtime=(tmdb_movie.runtime if tmdb_movie else None),
            vote_average=(tmdb_movie.vote_average if tmdb_movie else tmdb_min.vote_average),
        )
        db.add(db_movie)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            movie_result = await db.execute(select(Movie).where(Movie.tmdb_id == movie_id))
            db_movie = movie_result.scalar_one_or_none()
        if not db_movie:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create movie record",
            )

    # Check if already favorited
    result = await db.execute(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.movie_id == db_movie.id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movie already in favorites"
        )
    
    favorite = Favorite(user_id=current_user.id, movie_id=db_movie.id)
    db.add(favorite)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movie already in favorites",
        )
    
    return {"success": True, "message": "Added to favorites"}


@router.delete("/favorites/{movie_id}")
async def remove_favorite(
    movie_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove movie from favorites"""
    movie_result = await db.execute(select(Movie).where(Movie.tmdb_id == movie_id))
    db_movie = movie_result.scalar_one_or_none()
    if not db_movie:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found",
        )

    result = await db.execute(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.movie_id == db_movie.id
        )
    )
    favorite = result.scalar_one_or_none()
    
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found"
        )
    
    await db.delete(favorite)
    await db.commit()
    
    return {"success": True, "message": "Removed from favorites"}
