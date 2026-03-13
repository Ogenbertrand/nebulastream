import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import MovieCard from '../../components/MovieCard/MovieCard';
import Loading from '../../components/Loading/Loading';
import { searchApi } from '../../services/api';
import { MovieListItem } from '../../types';

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchQuery = searchParams.get('q') || '';

  useEffect(() => {
    if (searchQuery) {
      performSearch(searchQuery);
    } else {
      setMovies([]);
    }
  }, [searchQuery]);

  const performSearch = async (q: string) => {
    if (!q.trim()) return;

    try {
      setLoading(true);
      const results = await searchApi.searchMovies(q);
      setMovies(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const data = await searchApi.getSuggestions(q, 5);
      setSuggestions(data.suggestions);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, fetchSuggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: any) => {
    setQuery(suggestion.title);
    setSearchParams({ q: suggestion.title });
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    setQuery('');
    setSearchParams({});
    setMovies([]);
    setSuggestions([]);
  };

  return (
    <>
      <Helmet>
        <title>{searchQuery ? `${searchQuery} - Search` : 'Search'} - NebulaStream</title>
        <meta name="description" content="Search for movies on NebulaStream" />
      </Helmet>

      <div className="min-h-screen bg-dark-950 pt-8 sm:pt-12 pb-16">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
          <div className="mb-10 glass-panel rounded-3xl p-6 sm:p-8 md:p-10">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-4">
              Search the Nebula
            </h1>
            <p className="text-white/60 mb-6">
              Find movies, actors, and stories that match your mood tonight.
            </p>

            <form onSubmit={handleSubmit} className="relative max-w-2xl 2xl:max-w-3xl">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search titles, actors, genres..."
                className="w-full pl-12 pr-12 py-3 sm:py-4 bg-dark-900/80 border border-white/10 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-nebula-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 glass-panel rounded-2xl shadow-xl z-50 max-h-72 sm:max-h-96 overflow-auto">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition text-left"
                    >
                      {suggestion.poster_path && (
                        <img
                          src={suggestion.poster_path}
                          alt={suggestion.title}
                          className="w-12 h-16 object-cover rounded-xl"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div>
                        <p className="text-white font-medium">{suggestion.title}</p>
                        {suggestion.year && (
                          <p className="text-white/50 text-sm">{suggestion.year}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>

          {searchQuery && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <h2 className="text-xl font-semibold text-white">Results for "{searchQuery}"</h2>
                <span className="text-white/60">
                  {movies.length} {movies.length === 1 ? 'movie' : 'movies'} found
                </span>
              </div>

              {loading ? (
                <Loading />
              ) : movies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-4 sm:gap-6">
                  {movies.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <SearchIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No results found</h3>
                  <p className="text-white/50">Try adjusting your search terms</p>
                </div>
              )}
            </div>
          )}

          {!searchQuery && (
            <div className="py-8">
              <h2 className="text-xl font-semibold text-white mb-4">Popular Searches</h2>
              <div className="flex flex-wrap gap-3">
                {['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller'].map(
                  (term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setQuery(term);
                        setSearchParams({ q: term });
                      }}
                      className="px-4 py-2 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
                    >
                      {term}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Search;
