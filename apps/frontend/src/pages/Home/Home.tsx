import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Hero from '../../components/Hero/Hero';
import MovieRow from '../../components/MovieRow/MovieRow';
import Loading from '../../components/Loading/Loading';
import { useMovieStore } from '../../store/movieStore';
import { moviesApi, watchHistoryApi } from '../../services/api';
import { MovieListItem, ContinueWatching } from '../../types';
import { useAuthStore } from '../../store/authStore';

const Home: React.FC = () => {
  const {
    trending,
    popular,
    topRated,
    genres,
    trendingLoading,
    popularLoading,
    topRatedLoading,
    genresLoading,
    fetchTrending,
    fetchPopular,
    fetchTopRated,
    fetchGenres,
  } = useMovieStore();

  const { isAuthenticated } = useAuthStore();

  const [actionMovies, setActionMovies] = useState<MovieListItem[]>([]);
  const [comedyMovies, setComedyMovies] = useState<MovieListItem[]>([]);
  const [recentMovies, setRecentMovies] = useState<MovieListItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatching[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  useEffect(() => {
    fetchTrending();
    fetchPopular();
    fetchTopRated();
    fetchGenres();
  }, [fetchTrending, fetchPopular, fetchTopRated, fetchGenres]);

  useEffect(() => {
    const loadExtras = async () => {
      try {
        setLoadingExtras(true);
        const actionId = genres.find((g) => g.name.toLowerCase() === 'action')?.id || 28;
        const comedyId = genres.find((g) => g.name.toLowerCase() === 'comedy')?.id || 35;

        const [action, comedy, recent] = await Promise.all([
          moviesApi.getByGenre(actionId, 1),
          moviesApi.getByGenre(comedyId, 1),
          moviesApi.getNowPlaying(1),
        ]);

        setActionMovies(action);
        setComedyMovies(comedy);
        setRecentMovies(recent);
      } catch (error) {
        console.error('Failed to load extra rows:', error);
      } finally {
        setLoadingExtras(false);
      }
    };

    if (genres.length > 0 && !genresLoading) {
      loadExtras();
    }
  }, [genres, genresLoading]);

  useEffect(() => {
    const loadContinueWatching = async () => {
      if (!isAuthenticated) return;
      try {
        const data = await watchHistoryApi.getContinueWatching(12);
        setContinueWatching(data);
      } catch (error) {
        console.error('Failed to fetch continue watching:', error);
      }
    };

    loadContinueWatching();
  }, [isAuthenticated]);

  const safeGenres = Array.isArray(genres) ? genres : [];
  const genreMap = useMemo(() => {
    return safeGenres.reduce(
      (acc, genre) => {
        acc[genre.id] = genre.name;
        return acc;
      },
      {} as Record<number, string>
    );
  }, [safeGenres]);

  const continueWatchingMovies = continueWatching.map((item) => item.movie);

  return (
    <>
      <Helmet>
        <title>NebulaStream - Watch Movies Online</title>
        <meta
          name="description"
          content="Stream the latest movies and TV shows on NebulaStream. Discover trending content, popular releases, and top-rated films."
        />
      </Helmet>

      <div className="min-h-screen bg-dark-950">
        <Hero />

        <div className="relative z-10 -mt-24 sm:-mt-32 pb-12">
          {isAuthenticated && continueWatchingMovies.length > 0 && (
            <MovieRow
              title="Continue Watching"
              movies={continueWatchingMovies}
              genreMap={genreMap}
            />
          )}

          <MovieRow
            title="Trending Now"
            movies={trending}
            loading={trendingLoading}
            genreMap={genreMap}
          />
          <MovieRow
            title="Top Rated"
            movies={topRated}
            loading={topRatedLoading}
            genreMap={genreMap}
          />
          <MovieRow
            title="Action Movies"
            movies={actionMovies}
            loading={loadingExtras}
            genreMap={genreMap}
          />
          <MovieRow
            title="Comedy"
            movies={comedyMovies}
            loading={loadingExtras}
            genreMap={genreMap}
          />
          <MovieRow
            title="Recently Added"
            movies={recentMovies}
            loading={loadingExtras}
            genreMap={genreMap}
          />
          <MovieRow
            title="Popular on NebulaStream"
            movies={popular}
            loading={popularLoading}
            genreMap={genreMap}
          />
        </div>

        {(trendingLoading || popularLoading || topRatedLoading) && <Loading />}
      </div>
    </>
  );
};

export default Home;
