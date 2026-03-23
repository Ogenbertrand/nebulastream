import { create } from 'zustand';
import { Movie, MovieListItem, Genre } from '../types';
import { moviesApi, searchApi } from '../services/api';

interface MovieState {
  // Trending
  trending: MovieListItem[];
  trendingLoading: boolean;

  // Popular
  popular: MovieListItem[];
  popularLoading: boolean;

  // Top Rated
  topRated: MovieListItem[];
  topRatedLoading: boolean;

  // Genres
  genres: Genre[];
  genresLoading: boolean;

  // Current movie
  currentMovie: Movie | null;
  currentMovieLoading: boolean;

  // Search results
  searchResults: MovieListItem[];
  searchLoading: boolean;
  searchQuery: string;

  // Actions
  fetchTrending: (timeWindow?: 'day' | 'week', page?: number) => Promise<void>;
  fetchPopular: (page?: number) => Promise<void>;
  fetchTopRated: (page?: number) => Promise<void>;
  fetchGenres: () => Promise<void>;
  fetchMovieDetail: (movieId: number) => Promise<void>;
  searchMovies: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useMovieStore = create<MovieState>((set, get) => ({
  // Initial state
  trending: [],
  trendingLoading: false,

  popular: [],
  popularLoading: false,

  topRated: [],
  topRatedLoading: false,

  genres: [],
  genresLoading: false,

  currentMovie: null,
  currentMovieLoading: false,

  searchResults: [],
  searchLoading: false,
  searchQuery: '',

  // Actions
  fetchTrending: async (timeWindow = 'week', page = 1) => {
    try {
      set({ trendingLoading: true });
      const trending = await moviesApi.getTrending(timeWindow, page);
      set({ trending });
    } catch (error) {
      console.error('Failed to fetch trending:', error);
    } finally {
      set({ trendingLoading: false });
    }
  },

  fetchPopular: async (page = 1) => {
    try {
      set({ popularLoading: true });
      const popular = await moviesApi.getPopular(page);
      set({ popular });
    } catch (error) {
      console.error('Failed to fetch popular:', error);
    } finally {
      set({ popularLoading: false });
    }
  },

  fetchTopRated: async (page = 1) => {
    try {
      set({ topRatedLoading: true });
      const topRated = await moviesApi.getTopRated(page);
      set({ topRated });
    } catch (error) {
      console.error('Failed to fetch top rated:', error);
    } finally {
      set({ topRatedLoading: false });
    }
  },

  fetchGenres: async () => {
    try {
      set({ genresLoading: true });
      const genres = await searchApi.getGenres();
      set({ genres });
    } catch (error) {
      console.error('Failed to fetch genres:', error);
    } finally {
      set({ genresLoading: false });
    }
  },

  fetchMovieDetail: async (movieId: number) => {
    try {
      set({ currentMovieLoading: true, currentMovie: null });
      const movie = await moviesApi.getDetail(movieId);
      set({ currentMovie: movie });
    } catch (error) {
      console.error('Failed to fetch movie detail:', error);
    } finally {
      set({ currentMovieLoading: false });
    }
  },

  searchMovies: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: '' });
      return;
    }

    try {
      set({ searchLoading: true, searchQuery: query });
      const results = await searchApi.searchMovies(query);
      set({ searchResults: results });
    } catch (error) {
      console.error('Failed to search movies:', error);
    } finally {
      set({ searchLoading: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: [], searchQuery: '' });
  },
}));
