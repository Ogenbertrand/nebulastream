import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { MovieListItem } from '../../types';

interface MovieCardProps {
  movie: MovieListItem;
  genreMap?: Record<number, string>;
  variant?: 'default' | 'row';
  mediaType?: 'movie' | 'tv';
}

const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  genreMap,
  variant = 'default',
  mediaType,
}) => {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const genres = movie.genre_ids
    ?.map((id) => genreMap?.[id])
    .filter(Boolean)
    .slice(0, 2) as string[];

  const posterClassName = variant === 'row' ? 'aspect-poster-row' : 'aspect-poster';
  const titleClassName =
    variant === 'row' ? 'text-[11px] sm:text-xs lg:text-sm' : 'text-xs sm:text-sm lg:text-base';
  const metaClassName = variant === 'row' ? 'text-[10px] sm:text-[11px]' : 'text-[10px] sm:text-xs';

  const posterUrl = movie.poster_path || movie.backdrop_path || '';
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [posterUrl, movie.id]);

  const fallbackLabel = useMemo(() => {
    const words = movie.title?.split(' ').filter(Boolean) || [];
    const initials = words.slice(0, 2).map((w) => w[0]).join('');
    return initials.toUpperCase() || 'NS';
  }, [movie.title]);

  const resolvedType = mediaType || movie.media_type || 'movie';
  const linkTarget = resolvedType === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`;

  const loadingMode = variant === 'row' ? 'eager' : 'lazy';

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 240, damping: 20 }}
    >
      <Link to={linkTarget} className="movie-card group">
        <div className={`${posterClassName} relative overflow-hidden rounded-2xl bg-dark-800`}>
          <div
            className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-dark-800 via-dark-700 to-dark-900 text-white/70 transition-opacity duration-300 ${
              posterUrl && !imageError && imageLoaded ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="w-14 h-14 rounded-full border border-white/15 flex items-center justify-center text-lg font-semibold">
              {fallbackLabel}
            </div>
            <span className="mt-3 text-xs text-white/50 px-3 text-center line-clamp-2">
              {movie.title}
            </span>
          </div>

          {posterUrl && !imageError && (
            <img
              src={posterUrl}
              alt={movie.title}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 transition-opacity ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading={loadingMode}
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(false);
              }}
            />
          )}

          <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 border border-white/15 backdrop-blur-md">
            <Star className="w-3 h-3 text-yellow-400 fill-current" />
            <span className="text-[11px] text-white font-semibold">
              {movie.vote_average.toFixed(1)}
            </span>
          </div>

        </div>

        <div className="mt-1">
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
            <div className="shrink-0" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default MovieCard;
