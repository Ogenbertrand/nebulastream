import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import MovieCard from '../../components/MovieCard/MovieCard';
import Loading from '../../components/Loading/Loading';
import { moviesApi, searchApi } from '../../services/api';
import { MovieListItem, Genre } from '../../types';

const Browse: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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

        if (selectedGenre) {
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
    [selectedGenre, sortBy]
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
          <div className="glass-panel rounded-3xl p-6 sm:p-8 md:p-10 mb-10">
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

          {movies.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-4 sm:gap-6">
                {movies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} genreMap={genreMap} />
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
