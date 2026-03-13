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
  const [dramaMovies, setDramaMovies] = useState<MovieListItem[]>([]);
  const [recentMovies, setRecentMovies] = useState<MovieListItem[]>([]);
  const [hollywoodMovies, setHollywoodMovies] = useState<MovieListItem[]>([]);
  const [bollywoodMovies, setBollywoodMovies] = useState<MovieListItem[]>([]);
  const [nollywoodMovies, setNollywoodMovies] = useState<MovieListItem[]>([]);
  const [koreanMovies, setKoreanMovies] = useState<MovieListItem[]>([]);
  const [japaneseMovies, setJapaneseMovies] = useState<MovieListItem[]>([]);
  const [chineseMovies, setChineseMovies] = useState<MovieListItem[]>([]);
  const [animeMovies, setAnimeMovies] = useState<MovieListItem[]>([]);
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
        const dramaId = genres.find((g) => g.name.toLowerCase() === 'drama')?.id || 18;

        const [
          action,
          comedy,
          drama,
          recent,
          hollywood,
          bollywood,
          nollywood,
          korean,
          japanese,
          chinese,
          anime,
        ] = await Promise.all([
          moviesApi.getByGenre(actionId, 1),
          moviesApi.getByGenre(comedyId, 1),
          moviesApi.getByGenre(dramaId, 1),
          moviesApi.getNowPlaying(1),
          moviesApi.getByOriginCountry('US', 1),
          moviesApi.getByOriginCountry('IN', 1),
          moviesApi.getByOriginCountry('NG', 1),
          moviesApi.getByOriginCountry('KR', 1),
          moviesApi.getByOriginCountry('JP', 1),
          moviesApi.getByOriginCountry('CN', 1),
          moviesApi.getByOriginCountry('JP', 1, 16),
        ]);

        setActionMovies(action);
        setComedyMovies(comedy);
        setDramaMovies(drama);
        setRecentMovies(recent);
        setHollywoodMovies(hollywood);
        setBollywoodMovies(bollywood);
        setNollywoodMovies(nollywood);
        setKoreanMovies(korean);
        setJapaneseMovies(japanese);
        setChineseMovies(chinese);
        setAnimeMovies(anime);
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

  const genreMap = useMemo(() => {
    const safeGenres = Array.isArray(genres) ? genres : [];
    return safeGenres.reduce(
      (acc, genre) => {
        acc[genre.id] = genre.name;
        return acc;
      },
      {} as Record<number, string>
    );
  }, [genres]);

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

        <div className="relative z-10 -mt-8 sm:-mt-24 lg:-mt-32 pb-12">
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
            title="Hollywood Movies"
            movies={hollywoodMovies}
            loading={loadingExtras}
            genreMap={genreMap}
          />
          <MovieRow
            title="Bollywood Movies"
            movies={bollywoodMovies}
            loading={loadingExtras}
            genreMap={genreMap}
          />
          <MovieRow
            title="Nollywood Movies"
            movies={nollywoodMovies}
            loading={loadingExtras}
            genreMap={genreMap}
          />
          <MovieRow
            title="Korean Movies"
            movies={koreanMovies}
            loading={loadingExtras}
            genreMap={genreMap}
          />
          <MovieRow
            title="Japanese Movies"
            movies={japaneseMovies}
            loading={loadingExtras}
            genreMap={genreMap}
          />
          <MovieRow
            title="Chinese Movies"
            movies={chineseMovies}
            loading={loadingExtras}
            genreMap={genreMap}
          />
          <MovieRow
            title="Anime / Animation"
            movies={animeMovies}
            loading={loadingExtras}
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
            title="Drama Movies"
            movies={dramaMovies}
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
          <MovieRow
            title="Top Rated"
            movies={topRated}
            loading={topRatedLoading}
            genreMap={genreMap}
          />
        </div>

        {(trendingLoading || popularLoading || topRatedLoading) && <Loading />}
      </div>
    </>
  );
};

export default Home;
