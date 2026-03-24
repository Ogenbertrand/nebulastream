import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Heart, Trash2, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { userApi, watchHistoryApi } from '../../services/api';
import { ContinueWatching } from '../../types';
import MovieCard from '../../components/MovieCard/MovieCard';
import Loading from '../../components/Loading/Loading';
import toast from 'react-hot-toast';

const Watchlist: React.FC = () => {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatching[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [favData, historyData] = await Promise.all([
        userApi.getFavorites(),
        watchHistoryApi.getContinueWatching(10),
      ]);
      setFavorites(favData.favorites);
      setContinueWatching(historyData);
    } catch (error) {
      toast.error('Failed to load your list');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (movieId: number) => {
    try {
      await userApi.removeFavorite(movieId);
      setFavorites((prev) => prev.filter((f) => f.movie_id !== movieId));
      toast.success('Removed from your list');
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your watch history?')) return;

    try {
      await watchHistoryApi.clearHistory();
      setContinueWatching([]);
      toast.success('Watch history cleared');
    } catch (error) {
      toast.error('Failed to clear history');
    }
  };

  if (loading) {
    return <Loading fullScreen />;
  }

  return (
    <>
      <Helmet>
        <title>My List - NebulaStream</title>
      </Helmet>

      <div className="min-h-screen bg-dark-950 pt-6 sm:pt-8 pb-16">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden glass-panel rounded-3xl p-5 sm:p-7 md:p-9 mb-8">
            <div className="absolute -top-20 -right-10 w-60 h-60 bg-nebula-500/20 blur-[80px]" />
            <div className="absolute -bottom-24 left-0 w-72 h-72 bg-accent-500/20 blur-[90px]" />
            <div className="relative">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">My List</h1>
              <p className="text-white/60 mt-2">Your favorites, history, and unfinished stories.</p>
              <div className="flex flex-wrap gap-3 mt-4 text-xs uppercase tracking-[0.3em] text-white/50">
                <span>{favorites.length} Favorites</span>
                <span>•</span>
                <span>{continueWatching.length} In Progress</span>
              </div>
            </div>
          </div>

          {/* Continue Watching */}
          {continueWatching.length > 0 && (
            <section className="mb-12">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">Continue Watching</h2>
                  <p className="text-white/50 text-sm">Pick up right where you left off.</p>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="text-white/50 hover:text-red-400 text-sm flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear History
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-4 sm:gap-6">
                {continueWatching.map((item) => (
                  <div key={item.movie.id} className="relative group">
                    <MovieCard movie={item.movie} />

                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-dark-800">
                      <div
                        className="h-full bg-nebula-500"
                        style={{ width: `${item.progress_percent}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                      <span>{Math.round(item.progress_percent)}% watched</span>
                      <Link
                        to={`/watch/${item.movie.id}`}
                        className="text-nebula-400 hover:text-nebula-300 flex items-center"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Resume
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Favorites */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">My Favorites</h2>
                <p className="text-white/50 text-sm">Saved for your perfect movie night.</p>
              </div>
            </div>

            {favorites.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-5">
                {favorites.map((favorite) => (
                  <div key={favorite.movie_id} className="relative group">
                    {favorite.movie ? (
                      <MovieCard movie={favorite.movie} />
                    ) : (
                      <div className="aspect-poster bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl flex flex-col items-center justify-center gap-3 border border-white/5">
                        <div className="w-12 h-12 rounded-full bg-nebula-500/20 flex items-center justify-center">
                          <Heart className="w-6 h-6 text-nebula-500" />
                        </div>
                        <span className="text-xs text-white/60 px-3 text-center">
                          Favorite #{favorite.movie_id}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveFavorite(favorite.movie_id)}
                      className="absolute top-2 right-2 p-2 bg-dark-900/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 glass-panel rounded-3xl">
                <Heart className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No favorites yet</h3>
                <p className="text-white/50 mb-4">
                  Start adding movies to your favorites to see them here
                </p>
                <Link to="/browse" className="btn-primary">
                  Browse Movies
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default Watchlist;
