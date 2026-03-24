import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Hero from '../../components/Hero/Hero';
import MovieRow from '../../components/MovieRow/MovieRow';
import Loading from '../../components/Loading/Loading';
import { useMovieStore } from '../../store/movieStore';
import { moviesApi, tvApi, watchHistoryApi } from '../../services/api';
import { MovieListItem, ContinueWatching } from '../../types';
import { useAuthStore } from '../../store/authStore';

const shuffleMovies = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const MIN_RELEASE_YEAR = 2009;
const filterRecentMovies = (items: MovieListItem[]) =>
  items.filter((item) => {
    if (!item.release_date) return false;
    const year = new Date(item.release_date).getFullYear();
    return year >= MIN_RELEASE_YEAR;
  });

const stablePage = () => 1;

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
  const [recentTv, setRecentTv] = useState<MovieListItem[]>([]);
  const [trendingTv, setTrendingTv] = useState<MovieListItem[]>([]);
  const [tvSeriesForYou, setTvSeriesForYou] = useState<MovieListItem[]>([]);
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
    fetchTrending('week', stablePage());
    fetchPopular(stablePage());
    fetchTopRated(stablePage());
    fetchGenres();
  }, [fetchTrending, fetchPopular, fetchTopRated, fetchGenres]);

  useEffect(() => {
    const loadExtras = async () => {
      try {
        setLoadingExtras(true);
        const actionId = genres.find((g) => g.name.toLowerCase() === 'action')?.id || 28;
        const comedyId = genres.find((g) => g.name.toLowerCase() === 'comedy')?.id || 35;
        const dramaId = genres.find((g) => g.name.toLowerCase() === 'drama')?.id || 18;

        const tasks: Promise<void>[] = [
          moviesApi
            .getByGenre(actionId, stablePage())
            .then((data) => setActionMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load action movies:', error)),
          moviesApi
            .getByGenre(comedyId, stablePage())
            .then((data) => setComedyMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load comedy movies:', error)),
          moviesApi
            .getByGenre(dramaId, stablePage())
            .then((data) => setDramaMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load drama movies:', error)),
          moviesApi
            .getNowPlaying(stablePage())
            .then((data) => setRecentMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load recent movies:', error)),
          tvApi
            .getOnTheAir(stablePage())
            .then((data) => setRecentTv(shuffleMovies(data)))
            .catch((error) => console.error('Failed to load on-the-air TV:', error)),
          tvApi
            .getPopular(stablePage())
            .then((data) => setTvSeriesForYou(shuffleMovies(data)))
            .catch((error) => console.error('Failed to load TV series for you:', error)),
          moviesApi
            .getByOriginCountry('US', stablePage())
            .then((data) => setHollywoodMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load Hollywood movies:', error)),
          moviesApi
            .getByOriginCountry('IN', stablePage())
            .then((data) => setBollywoodMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load Bollywood movies:', error)),
          moviesApi
            .getByOriginCountry('NG', stablePage())
            .then((data) => setNollywoodMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load Nollywood movies:', error)),
          moviesApi
            .getByOriginCountry('KR', stablePage())
            .then((data) => setKoreanMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load Korean movies:', error)),
          moviesApi
            .getByOriginCountry('JP', stablePage())
            .then((data) => setJapaneseMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load Japanese movies:', error)),
          moviesApi
            .getByOriginCountry('CN', stablePage())
            .then((data) => setChineseMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load Chinese movies:', error)),
          moviesApi
            .getByOriginCountry('JP', stablePage(), 16)
            .then((data) => setAnimeMovies(shuffleMovies(filterRecentMovies(data))))
            .catch((error) => console.error('Failed to load anime movies:', error)),
        ];

        await Promise.allSettled(tasks);
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
    const loadTrendingTv = async () => {
      try {
        const data = await tvApi.getTrending('week', stablePage());
        setTrendingTv(data);
      } catch (error) {
        console.error('Failed to fetch trending TV:', error);
      }
    };

    loadTrendingTv();
  }, []);

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

  const shuffledTrending = useMemo(() => shuffleMovies(trending), [trending]);
  const shuffledPopular = useMemo(() => shuffleMovies(popular), [popular]);
  const shuffledTopRated = useMemo(() => shuffleMovies(topRated), [topRated]);
  const filteredTrending = useMemo(() => filterRecentMovies(shuffledTrending), [shuffledTrending]);
  const filteredPopular = useMemo(() => filterRecentMovies(shuffledPopular), [shuffledPopular]);
  const filteredTopRated = useMemo(() => filterRecentMovies(shuffledTopRated), [shuffledTopRated]);

  const combinedTrending = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const movies = filteredTrending.map((item) => ({ ...item, media_type: 'movie' as const }));
    const shows = trendingTv.map((item) => ({ ...item, media_type: 'tv' as const }));
    const merged = [...movies, ...shows].filter((item) => {
      const dateValue = item.release_date || (item as { first_air_date?: string }).first_air_date;
      if (!dateValue) return false;
      const year = new Date(dateValue).getFullYear();
      return year === currentYear;
    });
    merged.sort((a, b) => {
      const aDateValue = a.release_date || (a as { first_air_date?: string }).first_air_date;
      const bDateValue = b.release_date || (b as { first_air_date?: string }).first_air_date;
      const aDate = aDateValue ? new Date(aDateValue).getTime() : 0;
      const bDate = bDateValue ? new Date(bDateValue).getTime() : 0;
      return bDate - aDate;
    });
    const tvHighlights = merged.filter((item) => item.media_type === 'tv').slice(0, 6);
    const tvHighlightKeys = new Set(
      tvHighlights.map((item) => `${item.media_type || 'movie'}-${item.id}`)
    );
    const mergedRest = merged.filter(
      (item) => !tvHighlightKeys.has(`${item.media_type || 'movie'}-${item.id}`)
    );
    const hollywood = hollywoodMovies
      .map((item) => ({ ...item, media_type: 'movie' as const }))
      .filter((item) => {
        if (!item.release_date) return false;
        return new Date(item.release_date).getFullYear() === currentYear;
      })
      .sort((a, b) => {
        const aDate = a.release_date ? new Date(a.release_date).getTime() : 0;
        const bDate = b.release_date ? new Date(b.release_date).getTime() : 0;
        return bDate - aDate;
      });

    const seen = new Set<string>();
    const addUnique = (items: MovieListItem[]) =>
      items.filter((item) => {
        const key = `${item.media_type || 'movie'}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return [...addUnique(hollywood), ...addUnique(tvHighlights), ...addUnique(mergedRest)];
  }, [filteredTrending, trendingTv, hollywoodMovies]);

  const combinedLatest = useMemo(() => {
    const movies = recentMovies.map((item) => ({ ...item, media_type: 'movie' as const }));
    const shows = recentTv.map((item) => ({ ...item, media_type: 'tv' as const }));
    const merged = [...movies, ...shows];
    merged.sort((a, b) => {
      const aDate = a.release_date ? new Date(a.release_date).getTime() : 0;
      const bDate = b.release_date ? new Date(b.release_date).getTime() : 0;
      return bDate - aDate;
    });
    return merged;
  }, [recentMovies, recentTv]);

  const continueWatchingMovies = filterRecentMovies(continueWatching.map((item) => item.movie));

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

        <div className="relative z-10 mt-0 pb-12">
          {isAuthenticated && continueWatchingMovies.length > 0 && (
            <MovieRow
              title="Continue Watching"
              movies={continueWatchingMovies}
              genreMap={genreMap}
            />
          )}

          <MovieRow
            title="Trending Now"
            movies={combinedTrending}
            loading={trendingLoading && trendingTv.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="TV Series for you"
            movies={tvSeriesForYou}
            loading={loadingExtras && tvSeriesForYou.length === 0}
            genreMap={genreMap}
            mediaType="tv"
          />
          <MovieRow
            title="Hollywood Movies"
            movies={hollywoodMovies}
            loading={loadingExtras && hollywoodMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Bollywood Movies"
            movies={bollywoodMovies}
            loading={loadingExtras && bollywoodMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Nollywood Movies"
            movies={nollywoodMovies}
            loading={loadingExtras && nollywoodMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Korean Movies"
            movies={koreanMovies}
            loading={loadingExtras && koreanMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Japanese Movies"
            movies={japaneseMovies}
            loading={loadingExtras && japaneseMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Chinese Movies"
            movies={chineseMovies}
            loading={loadingExtras && chineseMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Anime / Animation"
            movies={animeMovies}
            loading={loadingExtras && animeMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Action Movies"
            movies={actionMovies}
            loading={loadingExtras && actionMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Comedy"
            movies={comedyMovies}
            loading={loadingExtras && comedyMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Drama Movies"
            movies={dramaMovies}
            loading={loadingExtras && dramaMovies.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Latest Releases"
            movies={combinedLatest}
            loading={loadingExtras && combinedLatest.length === 0}
            genreMap={genreMap}
          />
          <MovieRow
            title="Popular on NebulaStream"
            movies={filteredPopular}
            loading={popularLoading}
            genreMap={genreMap}
          />
          <MovieRow
            title="Top Rated"
            movies={filteredTopRated}
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
