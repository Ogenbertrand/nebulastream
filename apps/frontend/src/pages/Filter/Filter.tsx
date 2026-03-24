import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal, ChevronDown } from 'lucide-react';
import MovieCard from '../../components/MovieCard/MovieCard';
import Loading from '../../components/Loading/Loading';
import { moviesApi, searchApi, tvApi } from '../../services/api';
import { Genre, MovieListItem } from '../../types';

const Filter: React.FC = () => {
  const navigate = useNavigate();
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'movie' | 'tv' | 'animation'>('movie');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const years = useMemo(() => {
    const uniqueYears = new Set<number>();
    movies.forEach((m) => {
      if (m.release_date) {
        const y = new Date(m.release_date).getFullYear();
        if (!Number.isNaN(y)) uniqueYears.add(y);
      }
    });
    return Array.from(uniqueYears).sort((a, b) => b - a);
  }, [movies]);

  const filteredMovies = useMemo(
    () =>
      movies.filter((m) => {
        const yearOk =
          !selectedYear ||
          (m.release_date && new Date(m.release_date).getFullYear() === selectedYear);
        const genreOk = !selectedGenre || (m.genre_ids && m.genre_ids.includes(selectedGenre));
        return yearOk && genreOk;
      }),
    [movies, selectedGenre, selectedYear]
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (tab === 'tv') {
          const [tvData, genreData] = await Promise.all([
            tvApi.getPopular(1),
            searchApi.getGenres('tv'),
          ]);
          setMovies(tvData);
          setGenres(genreData);
        } else if (tab === 'animation') {
          const [movieData, genreData] = await Promise.all([
            moviesApi.getByGenre(16, 1),
            searchApi.getGenres('movie'),
          ]);
          setMovies(movieData);
          setGenres(genreData);
        } else {
          const [movieData, genreData] = await Promise.all([
            moviesApi.getPopular(1),
            searchApi.getGenres('movie'),
          ]);
          setMovies(movieData);
          setGenres(genreData);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tab]);

  return (
    <>
      <Helmet>
        <title>Filter Movies - NebulaStream</title>
      </Helmet>

      <div className="min-h-screen bg-dark-950 pt-6 pb-20">
        <div className="max-w-screen-md mx-auto px-4">
          {/* Header bar */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-white/5 text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-white font-semibold">Filter</h1>
            <span className="w-8" />
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mb-4 border-b border-white/10">
            {[
              { key: 'movie', label: 'Movie' },
              { key: 'tv', label: 'TV show' },
              { key: 'animation', label: 'Animation' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key as typeof tab)}
                className={`pb-2 text-sm ${
                  tab === item.key ? 'text-white border-b-2 border-nebula-500' : 'text-white/60'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 mb-4">
            {/* Genre select */}
            <div className="relative flex-1">
              <select
                value={selectedGenre ?? ''}
                onChange={(e) => setSelectedGenre(e.target.value ? Number(e.target.value) : null)}
                className="w-full appearance-none rounded-full bg-dark-900 border border-white/10 px-3 pr-7 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-nebula-500"
              >
                <option value="">{genres.length ? 'Genre' : 'Loading genres...'}</option>
                <option value="">All genres</option>
                {genres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-white/70" />
            </div>

            {/* Year select */}
            <div className="relative flex-1">
              <select
                value={selectedYear ?? ''}
                onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                className="w-full appearance-none rounded-full bg-dark-900 border border-white/10 px-3 pr-7 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-nebula-500"
              >
                <option value="">{years.length ? 'Year' : 'Loading years...'}</option>
                <option value="">Any year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-white/70" />
            </div>

            <button className="p-2 rounded-full bg-nebula-500 text-white flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-white font-semibold mb-3 text-sm">
            {tab === 'tv'
              ? 'Watch TV Shows'
              : tab === 'animation'
                ? 'Watch Animation'
                : 'Watch Movies'}
          </h2>

          {loading ? (
            <Loading />
          ) : (
            <div className="grid grid-cols-3 gap-3 pb-8">
              {filteredMovies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} mediaType={tab === 'tv' ? 'tv' : 'movie'} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Filter;
