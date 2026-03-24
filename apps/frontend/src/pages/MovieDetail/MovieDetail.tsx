import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Play, Plus, Check, Star, Clock, Calendar, ArrowLeft, Share2, Loader2 } from 'lucide-react';
import { moviesApi, userApi } from '../../services/api';
import { Movie, MovieListItem } from '../../types';
import MovieRow from '../../components/MovieRow/MovieRow';
import Loading from '../../components/Loading/Loading';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
  const [recommendations, setRecommendations] = useState<MovieListItem[]>([]);

  const renderCastCard = (actor: any) => (
    <div key={actor.id} className="text-center">
      <div className="aspect-square rounded-2xl overflow-hidden mb-2 bg-dark-800 border border-white/5">
        {actor.profile_path ? (
          <img
            src={actor.profile_path}
            alt={actor.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/40 text-xs">No Photo</span>
          </div>
        )}
      </div>
      <p className="text-white text-sm font-medium line-clamp-1">{actor.name}</p>
      <p className="text-white/50 text-xs line-clamp-1">{actor.character}</p>
    </div>
  );

  useEffect(() => {
    if (id) {
      fetchMovieDetail(parseInt(id));
    }
  }, [id]);

  const fetchMovieDetail = async (movieId: number) => {
    try {
      setLoading(true);
      const data = await moviesApi.getDetail(movieId);
      setMovie(data);

      const recs = await moviesApi.getRecommendations(movieId);
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to fetch movie detail:', error);
      toast.error('Failed to load movie details');
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to add to your list');
      return;
    }

    if (!movie) return;

    if (isUpdatingFavorite) return;

    try {
      setIsUpdatingFavorite(true);
      if (isFavorite) {
        await userApi.removeFavorite(movie.id);
        setIsFavorite(false);
        toast.success('Removed from your list');
      } else {
        await userApi.addFavorite(movie.id);
        setIsFavorite(true);
        toast.success('Added to your list');
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    } finally {
      setIsUpdatingFavorite(false);
    }
  };

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Movie Not Found</h1>
          <Link to="/" className="btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;

  return (
    <>
      <Helmet>
        <title>{movie.title} - NebulaStream</title>
        <meta
          name="description"
          content={movie.overview || `Watch ${movie.title} on NebulaStream`}
        />
      </Helmet>

      <div className="min-h-screen bg-dark-950">
        <button
          onClick={() => navigate(-1)}
          className="fixed top-4 left-4 sm:left-6 z-30 w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white hover:bg-white/10 transition"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <div className="relative h-[55vh] sm:h-[68vh] lg:h-[78vh] 2xl:h-[86vh] min-h-[380px] sm:min-h-[500px]">
          <div className="absolute inset-0">
            {movie.backdrop_path ? (
              <img
                src={movie.backdrop_path}
                alt={movie.title}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-dark-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/35 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/30 to-transparent" />
          </div>

          {/* Mobile poster thumbnail pinned to the hero image (top-left) */}
          <div className="absolute right-4 top-4 z-20 w-20 sm:w-24 lg:hidden pointer-events-none">
            <div className="aspect-poster rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              {movie.poster_path ? (
                <img
                  src={movie.poster_path}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-dark-800 flex items-center justify-center">
                  <span className="text-white/40 text-xs">No Image</span>
                </div>
              )}
            </div>
          </div>

          <div className="relative h-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 flex items-end pb-0 sm:pb-10 lg:pb-12">
            <div className="relative flex flex-col lg:flex-row gap-6 sm:gap-10 items-start lg:items-end w-full">
              <div className="hidden lg:block w-60 2xl:w-72">
                <div className="aspect-poster rounded-2xl overflow-hidden shadow-2xl">
                  {movie.poster_path ? (
                    <img
                      src={movie.poster_path}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full bg-dark-800 flex items-center justify-center">
                      <span className="text-white/40">No Image</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="max-w-2xl 2xl:max-w-3xl w-full">
                <h1 className="text-3xl sm:text-5xl 2xl:text-6xl font-display font-bold text-white mb-2 sm:mb-4">
                  {movie.title}
                </h1>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-white/70 mb-3 sm:mb-4">
                  <span className="flex items-center gap-1 text-green-400">
                    <Star className="w-4 h-4 fill-current" />
                    {movie.vote_average.toFixed(1)}
                  </span>
                  {year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {year}
                    </span>
                  )}
                  {movie.runtime && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                  {movie.genres?.map((genre) => (
                    <span
                      key={genre.id}
                      className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <Link to={`/watch/${movie.id}`} className="btn-primary">
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    Play
                  </Link>
                  <button onClick={handleFavoriteToggle} className="btn-secondary">
                    {isFavorite ? (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        {isUpdatingFavorite ? (
                          <>
                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          </>
                        ) : (
                          'In My List'
                        )}
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mr-2" />
                        {isUpdatingFavorite ? (
                          <>
                            Adding...
                          </>
                        ) : (
                          'Add to List'
                        )}
                      </>
                    )}
                  </button>
                  <button className="btn-ghost">
                    <Share2 className="w-5 h-5 mr-2" />
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-10 sm:py-12 pb-28 md:pb-12">
          {(movie.tagline || movie.overview) && (
            <section className="mb-10">
              <div className="glass-panel rounded-3xl p-5 sm:p-7">
                <h2 className="text-white font-semibold text-lg mb-3">Story</h2>
                {movie.tagline && <p className="text-white/70 italic mb-3">{movie.tagline}</p>}
                {movie.overview && (
                  <p className="text-white/80 leading-relaxed text-sm sm:text-base">
                    {movie.overview}
                  </p>
                )}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            <div className="lg:col-span-2 space-y-10">
              {movie.cast && movie.cast.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-6">Cast</h2>
                  <div className="lg:hidden overflow-x-auto pb-3 -mx-1">
                    <div className="grid grid-rows-2 auto-cols-[140px] grid-flow-col gap-3 px-1">
                      {movie.cast.slice(0, 12).map((actor) => renderCastCard(actor))}
                    </div>
                  </div>

                  <div className="hidden lg:grid grid-cols-4 xl:grid-cols-5 gap-4">
                    {movie.cast.slice(0, 15).map((actor) => renderCastCard(actor))}
                  </div>
                </section>
              )}

              {movie.similar && movie.similar.length > 0 && (
                <MovieRow title="Similar Movies" movies={movie.similar} />
              )}

              {recommendations.length > 0 && (
                <MovieRow title="Recommended For You" movies={recommendations} />
              )}
            </div>

            <div className="space-y-6">
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Details</h3>
                <div className="space-y-3 text-sm text-white/70">
                  <div className="flex justify-between">
                    <span>Original Title</span>
                    <span className="text-white">{movie.original_title || movie.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Language</span>
                    <span className="text-white uppercase">{movie.original_language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Popularity</span>
                    <span className="text-white">{movie.popularity.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vote Count</span>
                    <span className="text-white">{movie.vote_count.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MovieDetail;
