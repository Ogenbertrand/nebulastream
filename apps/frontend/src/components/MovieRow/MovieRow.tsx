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
}

const MovieRow: React.FC<MovieRowProps> = ({ title, movies, loading = false, genreMap }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [cardWidth, setCardWidth] = useState(160);

  useEffect(() => {
    const updateSizes = () => {
      const width = window.innerWidth;
      const nextCardWidth = width >= 768 ? 224 : width >= 640 ? 192 : 160;
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

  const gap = 16;
  const itemWidth = cardWidth + gap;
  const totalWidth = movies.length * itemWidth;
  const overscan = 3;
  const visibleCount = containerWidth
    ? Math.ceil(containerWidth / itemWidth) + overscan
    : movies.length;
  const startIndex = Math.max(0, Math.floor(scrollLeft / itemWidth) - overscan);
  const endIndex = Math.min(movies.length, startIndex + visibleCount + overscan);
  const visibleMovies = useMemo(
    () => movies.slice(startIndex, endIndex),
    [movies, startIndex, endIndex]
  );
  const rowHeight = Math.round(cardWidth * 1.7 + 80);

  if (loading) {
    return (
      <div className="py-6">
        <div className="h-6 w-48 bg-dark-800 rounded-full animate-pulse mb-4" />
        <div className="flex space-x-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-40">
              <div className="aspect-poster bg-dark-800 rounded-2xl animate-pulse" />
              <div className="h-4 w-3/4 bg-dark-800 rounded animate-pulse mt-3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (movies.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="py-6 relative group"
    >
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-wide">{title}</h2>
        <span className="text-xs uppercase tracking-[0.3em] text-white/40">Explore</span>
      </div>

      <div className="relative">
        <div className="row-mask-left" />
        <div className="row-mask-right" />

        <button
          onClick={() => scroll('left')}
          className="absolute left-3 top-0 bottom-0 z-10 w-10 hidden sm:flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition opacity-0 group-hover:opacity-100"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div ref={scrollRef} className="overflow-x-auto hide-scrollbar px-4 sm:px-6 lg:px-8 pb-4">
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
                  <MovieCard movie={movie} genreMap={genreMap} />
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-3 top-0 bottom-0 z-10 w-10 hidden sm:flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition opacity-0 group-hover:opacity-100"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </motion.section>
  );
};

export default MovieRow;
