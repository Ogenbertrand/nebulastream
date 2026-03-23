"""
User endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.auth import get_current_active_user
from core.database import get_db
from models.favorite import Favorite
from models.user import User
from models.watch_history import WatchHistory
from schemas.user import User as UserSchema, UserUpdate, UserProfile

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
        select(Favorite, User).join(User).where(Favorite.user_id == current_user.id)
    )
    favorites = result.scalars().all()
    
    # TODO: Return full movie details
    return {
        "favorites": [
            {
                "movie_id": fav.movie_id,
                "added_at": fav.created_at
            }
            for fav in favorites
        ]
    }


@router.post("/favorites/{movie_id}")
async def add_favorite(
    movie_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Add movie to favorites"""
    # Check if already favorited
    result = await db.execute(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.movie_id == movie_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movie already in favorites"
        )
    
    favorite = Favorite(user_id=current_user.id, movie_id=movie_id)
    db.add(favorite)
    await db.commit()
    
    return {"success": True, "message": "Added to favorites"}


@router.delete("/favorites/{movie_id}")
async def remove_favorite(
    movie_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove movie from favorites"""
    result = await db.execute(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.movie_id == movie_id
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
