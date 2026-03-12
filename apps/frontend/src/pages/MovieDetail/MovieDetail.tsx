import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Play, Plus, Check, Star, Clock, Calendar, ArrowLeft, Share2 } from 'lucide-react';
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
  const [recommendations, setRecommendations] = useState<MovieListItem[]>([]);

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

    try {
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
          className="fixed top-24 left-6 z-30 w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white hover:bg-white/10 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative h-[75vh] min-h-[520px]">
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
            <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/30 to-transparent" />
          </div>

          <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-end pb-16">
            <div className="flex flex-col lg:flex-row gap-10 items-end">
              <div className="hidden lg:block w-60">
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

              <div className="max-w-2xl">
                <h1 className="text-4xl sm:text-5xl font-display font-bold text-white mb-4">
                  {movie.title}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-white/70 mb-4">
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

                <div className="flex flex-wrap gap-2 mb-6">
                  {movie.genres?.map((genre) => (
                    <span
                      key={genre.id}
                      className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4 mb-6">
                  <Link to={`/watch/${movie.id}`} className="btn-primary">
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    Play
                  </Link>
                  <button onClick={handleFavoriteToggle} className="btn-secondary">
                    {isFavorite ? (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        In My List
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mr-2" />
                        Add to List
                      </>
                    )}
                  </button>
                  <button className="btn-ghost">
                    <Share2 className="w-5 h-5 mr-2" />
                    Share
                  </button>
                </div>

                {movie.tagline && (
                  <p className="text-lg text-white/60 italic mb-3">{movie.tagline}</p>
                )}
                <p className="text-white/80 leading-relaxed">{movie.overview}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
              {movie.cast && movie.cast.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-6">Cast</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {movie.cast.slice(0, 8).map((actor) => (
                      <div key={actor.id} className="text-center">
                        <div className="aspect-square rounded-2xl overflow-hidden mb-2 bg-dark-800">
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
                        <p className="text-white text-sm font-medium">{actor.name}</p>
                        <p className="text-white/50 text-xs">{actor.character}</p>
                      </div>
                    ))}
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
