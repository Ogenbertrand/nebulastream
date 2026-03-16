import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, ChevronRight } from 'lucide-react';
import MovieCard from '../../components/MovieCard/MovieCard';
import Loading from '../../components/Loading/Loading';
import { moviesApi, searchApi } from '../../services/api';
import { MovieListItem, Genre } from '../../types';

const Browse: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'hollywood' | 'nollywood' | 'action' | 'comedy' | 'horror'
  >('all');

  const selectedGenre = searchParams.get('genre');
  const sortBy = searchParams.get('sort') || 'popularity.desc';
  const genreMap = useMemo(() => {
    const safeGenres = Array.isArray(genres) ? genres : [];
    return safeGenres.reduce<Record<number, string>>((acc, genre) => {
      acc[genre.id] = genre.name;
      return acc;
    }, {});
  }, [genres]);

  const fetchGenres = async () => {
    try {
      const data = await searchApi.getGenres();
      setGenres(data);
    } catch (error) {
      console.error('Failed to fetch genres:', error);
    }
  };

  const fetchMovies = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      try {
        setLoading(true);
        let data: MovieListItem[];

        if (selectedCategory === 'hollywood') {
          data = await moviesApi.getByOriginCountry('US', pageNum);
        } else if (selectedCategory === 'nollywood') {
          data = await moviesApi.getByOriginCountry('NG', pageNum);
        } else if (selectedCategory === 'action') {
          // TMDB Action genre id 28
          data = await moviesApi.getByGenre(28, pageNum, sortBy);
        } else if (selectedCategory === 'comedy') {
          // TMDB Comedy genre id 35
          data = await moviesApi.getByGenre(35, pageNum, sortBy);
        } else if (selectedCategory === 'horror') {
          // TMDB Horror genre id 27
          data = await moviesApi.getByGenre(27, pageNum, sortBy);
        } else if (selectedGenre) {
          data = await moviesApi.getByGenre(parseInt(selectedGenre), pageNum, sortBy);
        } else {
          data = await moviesApi.getPopular(pageNum);
        }

        if (data.length === 0) {
          setHasMore(false);
        } else {
          setMovies((prev) => (reset ? data : [...prev, ...data]));
        }
      } catch (error) {
        console.error('Failed to fetch movies:', error);
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory, selectedGenre, sortBy]
  );

  useEffect(() => {
    fetchGenres();
  }, []);

  useEffect(() => {
    setMovies([]);
    setPage(1);
    setHasMore(true);
    fetchMovies(1, true);
  }, [selectedGenre, sortBy, fetchMovies]);

  useEffect(() => {
    if (movies.length === 0) return;
    setFeaturedIndex(0);
    const max = Math.min(movies.length, 10);
    const interval = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % max);
    }, 8000);
    return () => clearInterval(interval);
  }, [movies]);

  const handleGenreChange = (genreId: number | null) => {
    if (genreId) {
      searchParams.set('genre', genreId.toString());
    } else {
      searchParams.delete('genre');
    }
    setSearchParams(searchParams);
  };

  const handleSortChange = (sort: string) => {
    searchParams.set('sort', sort);
    setSearchParams(searchParams);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMovies(nextPage);
    }
  };

  const categoryBackgrounds = useMemo(
    () => ({
      All: movies[0]?.backdrop_path || movies[0]?.poster_path,
      Hollywood: movies[1]?.backdrop_path || movies[1]?.poster_path,
      Nollywood: movies[2]?.backdrop_path || movies[2]?.poster_path,
      Action: movies[3]?.backdrop_path || movies[3]?.poster_path,
      Comedy: movies[4]?.backdrop_path || movies[4]?.poster_path,
      Horror: movies[5]?.backdrop_path || movies[5]?.poster_path,
    }),
    [movies]
  );

  return (
    <>
      <Helmet>
        <title>Browse Movies - NebulaStream</title>
        <meta
          name="description"
          content="Browse movies by genre, popularity, ratings, and more on NebulaStream"
        />
      </Helmet>

      <div className="min-h-screen bg-dark-950 pt-8 sm:pt-10 pb-16">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
          {/* Desktop / tablet header */}
          <div className="hidden md:block glass-panel rounded-3xl p-6 sm:p-8 md:p-10 mb-10">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">
              Browse the Library
            </h1>
            <p className="text-white/60">Curate your watchlist by genre or mood.</p>

            <div className="flex flex-col lg:flex-row gap-4 mt-6">
              <div className="flex-1">
                <p className="text-sm text-white/60 mb-3">Genre</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleGenreChange(null)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      !selectedGenre
                        ? 'bg-nebula-500 text-white'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    All
                  </button>
                  {genres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => handleGenreChange(genre.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedGenre === genre.id.toString()
                          ? 'bg-nebula-500 text-white'
                          : 'bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-white/60 mb-3">Sort By</p>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="bg-dark-900/80 text-white rounded-full px-4 py-2 border border-white/10 focus:outline-none focus:ring-2 focus:ring-nebula-500"
                >
                  <option value="popularity.desc">Popularity</option>
                  <option value="vote_average.desc">Rating</option>
                  <option value="release_date.desc">Release Date</option>
                  <option value="vote_count.desc">Most Voted</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mobile header inspired by MovieBox */}
          <div className="md:hidden space-y-6 mb-8">
            {/* Hero / featured movie */}
            {movies.length > 0 && (
              <section
                className="rounded-3xl overflow-hidden bg-dark-900 border border-white/5 shadow-xl cursor-pointer"
                onClick={() => {
                  const featuredMovie = movies[featuredIndex] || movies[0];
                  navigate(`/movie/${featuredMovie.id}`);
                }}
              >
                <div className="relative">
                  {(() => {
                    const movie = movies[featuredIndex] || movies[0];
                    return (
                      <>
                        <div className="aspect-[16/9] overflow-hidden">
                          <img
                            src={movie.backdrop_path || movie.poster_path}
                            alt={movie.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                        <div className="absolute inset-x-4 bottom-4 space-y-2">
                          <p className="text-[11px] text-white/70 uppercase tracking-[0.18em]">
                            Featured
                          </p>
                          <h2 className="text-lg font-display font-semibold text-white line-clamp-2">
                            {movie.title}
                          </h2>
                          <p className="text-xs text-white/70 line-clamp-1">
                            {movie.release_date?.slice(0, 4)} • {movie.vote_average.toFixed(1)} ★
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </section>
            )}

            {/* Categories row styled like MovieBox */}
            <section className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-base">Categories</h2>
                <button
                  className="flex items-center gap-1 text-xs text-white/70 px-2 py-1 rounded-full bg-white/5"
                  onClick={() => navigate('/filter')}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Filters
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {['All', 'Hollywood', 'Nollywood', 'Action', 'Comedy', 'Horror'].map((label) => {
                  const key =
                    label === 'All'
                      ? 'all'
                      : label.toLowerCase() === 'hollywood'
                        ? 'hollywood'
                        : label.toLowerCase() === 'nollywood'
                          ? 'nollywood'
                          : label.toLowerCase();

                  const active = selectedCategory === key;

                  const handleClick = () => {
                    setSelectedCategory(key as typeof selectedCategory);
                    if (key === 'all') {
                      handleGenreChange(null);
                    }
                  };

                  const bgImage = (categoryBackgrounds as Record<string, string | undefined>)[
                    label
                  ];

                  return (
                    <button
                      key={label}
                      onClick={handleClick}
                      className={`relative h-16 min-w-[120px] rounded-2xl px-4 text-xs font-medium flex items-center justify-between shadow-sm overflow-hidden ${
                        active ? 'text-white' : 'text-white/90'
                      }`}
                    >
                      {bgImage && (
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${bgImage})` }}
                        />
                      )}
                      {!bgImage && (
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-white/0" />
                      )}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${
                          active
                            ? 'from-black/10 via-black/30 to-black/70'
                            : 'from-black/40 via-black/60 to-black/80'
                        }`}
                      />

                      <div className="relative z-10 flex items-center justify-between w-full">
                        <span>{label}</span>
                        {label === 'All' && (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/30">
                            <SlidersHorizontal className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Trending row */}
            {movies.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-white font-semibold text-base">Trending Movies</h2>
                  <button className="flex items-center gap-1 text-[11px] text-white/60">
                    View all
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {movies.slice(0, 10).map((movie) => (
                    <div key={movie.id} className="min-w-[122px] max-w-[132px]">
                      <MovieCard movie={movie} genreMap={genreMap} variant="row" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {movies.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-2 sm:gap-4 md:gap-5">
                {movies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} genreMap={genreMap} variant="row" />
                ))}
              </div>

              {hasMore && (
                <div className="mt-12 text-center">
                  <button onClick={loadMore} disabled={loading} className="btn-secondary">
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          ) : loading ? (
            <Loading />
          ) : (
            <div className="text-center py-12">
              <p className="text-white/50">No movies found</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Browse;
