import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import MovieCard from '../MovieCard/MovieCard';
import { MovieListItem } from '../../types';

interface MovieRowProps {
  title: string;
  movies: MovieListItem[];
  loading?: boolean;
  genreMap?: Record<number, string>;
  mediaType?: 'movie' | 'tv';
}

const MovieRow: React.FC<MovieRowProps> = ({
  title,
  movies,
  loading = false,
  genreMap,
  mediaType,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [cardWidth, setCardWidth] = useState(150);

  useEffect(() => {
    const updateSizes = () => {
      const width = window.innerWidth;
      const nextCardWidth =
        width >= 2560
          ? 280
          : width >= 1920
            ? 240
            : width >= 1536
              ? 220
              : width >= 1280
                ? 200
                : width >= 1024
                  ? 176
                  : width >= 768
                    ? 160
                    : width >= 640
                      ? 144
                      : 120;
      setCardWidth(nextCardWidth);
      setContainerWidth(scrollRef.current?.clientWidth || 0);
    };

    updateSizes();
    window.addEventListener('resize', updateSizes);
    return () => window.removeEventListener('resize', updateSizes);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollLeft(container.scrollLeft);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.85;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const gap = cardWidth >= 220 ? 14 : cardWidth >= 160 ? 10 : 6;
  const itemWidth = cardWidth + gap;
  const moviesWithImages = useMemo(
    () => movies.filter((movie) => movie.poster_path || movie.backdrop_path),
    [movies]
  );
  const totalWidth = moviesWithImages.length * itemWidth;
  const overscan = 3;
  const visibleCount = containerWidth
    ? Math.ceil(containerWidth / itemWidth) + overscan
    : moviesWithImages.length;
  const startIndex = Math.max(0, Math.floor(scrollLeft / itemWidth) - overscan);
  const endIndex = Math.min(moviesWithImages.length, startIndex + visibleCount + overscan);
  const visibleMovies = useMemo(
    () => moviesWithImages.slice(startIndex, endIndex),
    [moviesWithImages, startIndex, endIndex]
  );
  // Posters in horizontal rows use a shorter aspect ratio (3/4) + compact caption.
  const rowHeight = Math.round(cardWidth * 1.33 + 44);

  if (loading) {
    return (
      <div className="py-6">
        <div className="h-6 w-48 bg-dark-800 rounded-full animate-pulse mb-4" />
        <div className="flex space-x-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-32 sm:w-36 lg:w-40 2xl:w-48">
              <div className="aspect-poster bg-dark-800 rounded-2xl animate-pulse" />
              <div className="h-4 w-3/4 bg-dark-800 rounded animate-pulse mt-3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (moviesWithImages.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="pt-1 pb-0 sm:pt-1 sm:pb-0.5 relative group"
    >
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 2xl:px-10 mb-0.5 sm:mb-1">
        <h2 className="text-lg sm:text-xl lg:text-2xl 2xl:text-3xl font-semibold text-white tracking-wide">
          {title}
        </h2>
        <span className="hidden sm:inline text-xs uppercase tracking-[0.3em] text-white/40">
          Explore
        </span>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="overflow-x-auto hide-scrollbar px-3 sm:px-6 lg:px-8 2xl:px-10 pb-0"
        >
          <div className="relative" style={{ width: totalWidth || '100%', height: rowHeight }}>
            {visibleMovies.map((movie, index) => {
              const absoluteIndex = startIndex + index;
              return (
                <div
                  key={movie.id}
                  className="absolute top-0"
                  style={{
                    left: absoluteIndex * itemWidth,
                    width: cardWidth,
                  }}
                >
                  <MovieCard
                    movie={movie}
                    genreMap={genreMap}
                    variant="row"
                    mediaType={mediaType}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => scroll('left')}
          className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 hidden sm:flex items-center justify-center rounded-full bg-black/60 border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => scroll('right')}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 hidden sm:flex items-center justify-center rounded-full bg-black/60 border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.section>
  );
};

export default MovieRow;
