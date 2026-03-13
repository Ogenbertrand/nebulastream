import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Plus, Star, Check, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { MovieListItem } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { userApi } from '../../services/api';
import toast from 'react-hot-toast';

interface MovieCardProps {
  movie: MovieListItem;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  genreMap?: Record<number, string>;
  variant?: 'default' | 'row';
}

const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  isFavorite = false,
  onFavoriteToggle,
  genreMap,
  variant = 'default',
}) => {
  const { isAuthenticated } = useAuthStore();

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error('Please sign in to add to your list');
      return;
    }

    try {
      if (isFavorite) {
        await userApi.removeFavorite(movie.id);
        toast.success('Removed from your list');
      } else {
        await userApi.addFavorite(movie.id);
        toast.success('Added to your list');
      }
      onFavoriteToggle?.();
    } catch (error) {
      toast.error('Failed to update favorites');
    }
  };

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const genres = movie.genre_ids
    ?.map((id) => genreMap?.[id])
    .filter(Boolean)
    .slice(0, 2) as string[];

  const posterClassName = variant === 'row' ? 'aspect-poster-row' : 'aspect-poster';
  const titleClassName =
    variant === 'row'
      ? 'text-[11px] sm:text-xs lg:text-sm'
      : 'text-xs sm:text-sm lg:text-base';
  const metaClassName =
    variant === 'row' ? 'text-[10px] sm:text-[11px]' : 'text-[10px] sm:text-xs';

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 240, damping: 20 }}
    >
      <Link to={`/movie/${movie.id}`} className="movie-card group content-visibility-auto">
        <div className={`${posterClassName} relative overflow-hidden rounded-2xl bg-dark-800`}>
          {movie.poster_path ? (
            <img
              src={movie.poster_path}
              alt={movie.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-dark-800">
              <span className="text-white/40 text-sm">No Image</span>
            </div>
          )}

          {/* Rating badge (MovieBox-style: rating on the card). */}
          {variant === 'row' && (
            <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 border border-white/15 backdrop-blur-md">
              <Star className="w-3 h-3 text-yellow-400 fill-current" />
              <span className="text-[11px] text-white font-semibold">
                {movie.vote_average.toFixed(1)}
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link
                  to={`/watch/${movie.id}`}
                  className="w-9 h-9 rounded-full bg-white text-dark-950 flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Play className="w-4.5 h-4.5 fill-current" />
                </Link>
                <button
                  onClick={handleFavoriteClick}
                  className="w-8 h-8 rounded-full border border-white/40 text-white flex items-center justify-center hover:bg-white hover:text-dark-950 transition"
                >
                  {isFavorite ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
              <Link
                to={`/movie/${movie.id}`}
                className="w-8 h-8 rounded-full border border-white/30 text-white flex items-center justify-center hover:bg-white/10"
              >
                <Info className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-1.5">
          <h3
            className={`text-white font-medium ${titleClassName} line-clamp-1 group-hover:text-nebula-500 transition-colors leading-snug`}
          >
            {movie.title}
          </h3>
          <div
            className={`flex items-center justify-between mt-0.5 ${metaClassName} text-white/60`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {year && <span>{year}</span>}
              {genres && genres.length > 0 && (
                <span className="text-white/50 truncate">• {genres.join(' / ')}</span>
              )}
            </div>
            {variant !== 'row' && (
              <div className="flex items-center gap-1 shrink-0">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span>{movie.vote_average.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default MovieCard;
