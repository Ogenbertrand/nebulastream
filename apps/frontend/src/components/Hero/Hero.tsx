import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Plus, Info, Volume2, VolumeX } from 'lucide-react';
import ReactPlayer from 'react-player';
import { motion } from 'framer-motion';
import { Movie, MovieListItem } from '../../types';
import { moviesApi, userApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const Hero: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [featuredMovie, setFeaturedMovie] = useState<MovieListItem | null>(null);
  const [featuredDetail, setFeaturedDetail] = useState<Movie | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const trending = await moviesApi.getTrending('week', 1);
        if (trending.length > 0) {
          const randomIndex = Math.floor(Math.random() * Math.min(6, trending.length));
          setFeaturedMovie(trending[randomIndex]);
        }
      } catch (error) {
        console.error('Failed to fetch featured movie:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!featuredMovie) return;
      try {
        const detail = await moviesApi.getDetail(featuredMovie.id);
        setFeaturedDetail(detail);
      } catch (error) {
        console.error('Failed to fetch featured detail:', error);
      }
    };

    fetchDetail();
  }, [featuredMovie]);

  const trailerUrl = useMemo(() => {
    const trailers = featuredDetail?.trailers || [];
    const trailer =
      trailers.find((t) => t.site === 'YouTube' && t.type === 'Trailer') ||
      trailers.find((t) => t.site === 'YouTube');
    if (!trailer) return null;
    return `https://www.youtube.com/watch?v=${trailer.key}`;
  }, [featuredDetail]);

  const handleAddToList = async () => {
    if (!featuredMovie) return;
    if (!isAuthenticated) {
      toast.error('Please sign in to add to your list');
      return;
    }

    try {
      setIsAdding(true);
      await userApi.addFavorite(featuredMovie.id);
      toast.success('Added to your list');
    } catch (error) {
      toast.error('Failed to update favorites');
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative h-[60vh] sm:h-[70vh] lg:h-[78vh] 2xl:h-[86vh] min-h-[420px] sm:min-h-[520px] bg-dark-900 animate-pulse">
        <div className="absolute inset-0 hero-gradient" />
      </div>
    );
  }

  if (!featuredMovie) return null;

  const displayMovie = featuredDetail || featuredMovie;
  const year = displayMovie.release_date ? new Date(displayMovie.release_date).getFullYear() : null;

  return (
    <div className="relative h-[60vh] sm:h-[70vh] lg:h-[78vh] 2xl:h-[86vh] min-h-[420px] sm:min-h-[520px] overflow-hidden">
      <div className="absolute inset-0">
        {trailerUrl ? (
          <div className="absolute inset-0">
            <ReactPlayer
              url={trailerUrl}
              playing
              muted={isMuted}
              loop
              width="100%"
              height="100%"
              className="absolute inset-0"
              config={{
                youtube: {
                  playerVars: {
                    autoplay: 1,
                    controls: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                  },
                },
              }}
            />
            <div className="absolute inset-0 bg-black/35" />
          </div>
        ) : displayMovie.backdrop_path ? (
          <img
            src={displayMovie.backdrop_path}
            alt={displayMovie.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-dark-800" />
        )}
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-950/90 via-dark-950/40 to-transparent" />
      </div>

      <div className="relative h-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 flex items-end pb-10 sm:pb-14 lg:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="max-w-2xl 2xl:max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs uppercase tracking-[0.3em] text-white/70 mb-4">
            Featured
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl 2xl:text-7xl font-display font-bold text-white mb-4">
            {displayMovie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-white/70 mb-4">
            <span className="px-2 py-1 rounded-full bg-white/10 text-white font-semibold">
              {displayMovie.vote_average.toFixed(1)}
            </span>
            {year && <span>{year}</span>}
            {featuredDetail?.runtime && (
              <span>
                {Math.floor(featuredDetail.runtime / 60)}h {featuredDetail.runtime % 60}m
              </span>
            )}
          </div>

          <p className="text-white/80 text-sm sm:text-lg leading-relaxed line-clamp-3 mb-6 sm:mb-8">
            {displayMovie.overview || 'No overview available.'}
          </p>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link to={`/watch/${displayMovie.id}`} className="btn-primary">
              <Play className="w-5 h-5 mr-2 fill-current" />
              Play
            </Link>
            <button onClick={handleAddToList} className="btn-secondary" disabled={isAdding}>
              <Plus className="w-5 h-5 mr-2" />
              {isAdding ? 'Adding...' : 'My List'}
            </button>
            <Link to={`/movie/${displayMovie.id}`} className="btn-ghost">
              <Info className="w-5 h-5 mr-2" />
              Details
            </Link>
          </div>
        </motion.div>
      </div>

      <button
        onClick={() => setIsMuted((prev) => !prev)}
        className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/30 flex items-center justify-center text-white hover:bg-white/10 transition"
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </button>
    </div>
  );
};

export default Hero;
