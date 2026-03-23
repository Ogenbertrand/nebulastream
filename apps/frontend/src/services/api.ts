import axios, { AxiosInstance, AxiosError } from 'axios';
import toast from 'react-hot-toast';
import {
  Movie,
  MovieListItem,
  StreamResponse,
  PlaybackSessionResponse,
  Episode,
  User,
  UserProfile,
  WatchHistory,
  ContinueWatching,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  Genre,
} from '../types';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      if (status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        toast.error('Session expired. Please login again.');
      } else if (status === 403) {
        toast.error('You do not have permission to perform this action.');
      } else if (status === 404) {
        // Not found - handled by components
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
      } else if (data?.message) {
        toast.error(data.message);
      }
    } else if (error.request) {
      toast.error('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

// Movies API
export const moviesApi = {
  getTrending: async (
    timeWindow: 'day' | 'week' = 'week',
    page: number = 1
  ): Promise<MovieListItem[]> => {
    const response = await api.get(`/movies/trending?time_window=${timeWindow}&page=${page}`);
    return response.data;
  },

  getPopular: async (page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/movies/popular?page=${page}`);
    return response.data;
  },

  getTopRated: async (page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/movies/top-rated?page=${page}`);
    return response.data;
  },

  getUpcoming: async (page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/movies/upcoming?page=${page}`);
    return response.data;
  },

  getNowPlaying: async (page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/movies/now-playing?page=${page}`);
    return response.data;
  },

  getByGenre: async (
    genreId: number,
    page: number = 1,
    sortBy: string = 'popularity.desc'
  ): Promise<MovieListItem[]> => {
    const response = await api.get(`/movies/genres/${genreId}?page=${page}&sort_by=${sortBy}`);
    return response.data;
  },

  getByOriginCountry: async (
    countryCode: string,
    page: number = 1,
    genreId?: number
  ): Promise<MovieListItem[]> => {
    const params = new URLSearchParams({ page: page.toString() });
    if (genreId) {
      params.set('genre_id', genreId.toString());
    }
    const response = await api.get(`/movies/origin/${countryCode}?${params.toString()}`);
    return response.data;
  },

  getDetail: async (movieId: number): Promise<Movie> => {
    const response = await api.get(`/movies/${movieId}`);
    return response.data;
  },

  getSimilar: async (movieId: number, page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/movies/${movieId}/similar?page=${page}`);
    return response.data;
  },

  getRecommendations: async (movieId: number, page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/movies/${movieId}/recommendations?page=${page}`);
    return response.data;
  },
};

// Search API
export const searchApi = {
  searchMovies: async (
    query: string,
    page: number = 1,
    year?: number
  ): Promise<MovieListItem[]> => {
    let url = `/search/movies?q=${encodeURIComponent(query)}&page=${page}`;
    if (year) url += `&year=${year}`;
    const response = await api.get(url);
    return response.data;
  },

  searchTv: async (
    query: string,
    page: number = 1
  ): Promise<MovieListItem[]> => {
    const response = await api.get(
      `/search/tv?q=${encodeURIComponent(query)}&page=${page}`
    );
    return response.data;
  },

  getSuggestions: async (
    query: string,
    limit: number = 5
  ): Promise<{ query: string; suggestions: any[] }> => {
    const response = await api.get(
      `/search/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.data;
  },

  getGenres: async (type: 'movie' | 'tv' = 'movie'): Promise<Genre[]> => {
    const response = await api.get(`/search/genres?type=${type}`);
    return response.data.genres;
  },
};

// TV Shows API
export const tvApi = {
  getTrending: async (
    timeWindow: 'day' | 'week' = 'week',
    page: number = 1
  ): Promise<MovieListItem[]> => {
    const response = await api.get(`/tv/trending?time_window=${timeWindow}&page=${page}`);
    return response.data;
  },

  getPopular: async (page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/tv/popular?page=${page}`);
    return response.data;
  },

  getTopRated: async (page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/tv/top-rated?page=${page}`);
    return response.data;
  },

  getOnTheAir: async (page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/tv/on-the-air?page=${page}`);
    return response.data;
  },

  getByGenre: async (
    genreId: number,
    page: number = 1,
    sortBy: string = 'popularity.desc'
  ): Promise<MovieListItem[]> => {
    const response = await api.get(`/tv/genres/${genreId}?page=${page}&sort_by=${sortBy}`);
    return response.data;
  },

  getDetail: async (tvId: number): Promise<Movie> => {
    const response = await api.get(`/tv/${tvId}`);
    return response.data;
  },

  getRecommendations: async (tvId: number, page: number = 1): Promise<MovieListItem[]> => {
    const response = await api.get(`/tv/${tvId}/recommendations?page=${page}`);
    return response.data;
  },

  getSeason: async (tvId: number, seasonNumber: number): Promise<Episode[]> => {
    const response = await api.get(`/tv/${tvId}/season/${seasonNumber}`);
    return response.data;
  },
};

// Streams API
export const streamsApi = {
  getStreams: async (
    movieId: number,
    preferredQuality: string = '720p'
  ): Promise<StreamResponse> => {
    const response = await api.get(`/streams/${movieId}?preferred_quality=${preferredQuality}`);
    return response.data;
  },

  getTvStreams: async (
    tvId: number,
    season: number,
    episode: number,
    preferredQuality: string = '720p'
  ): Promise<StreamResponse> => {
    const response = await api.get(
      `/streams/tv/${tvId}?season=${season}&episode=${episode}&preferred_quality=${preferredQuality}`
    );
    return response.data;
  },

  createSession: async (
    movieId: number,
    preferredQuality: string = '720p',
    preferredLanguage: string = 'en',
    sourceUrl?: string,
    headers?: Record<string, string>
  ): Promise<PlaybackSessionResponse> => {
    const params: Record<string, string> = {
      preferred_quality: preferredQuality,
      preferred_language: preferredLanguage,
    };
    const body: Record<string, any> = {};
    if (sourceUrl) {
      body.source_url = sourceUrl;
    }
    if (headers && Object.keys(headers).length > 0) {
      body.headers = headers;
    }

    const response = await api.post(`/streams/${movieId}/session`, body, { params });
    return response.data;
  },

  createTvSession: async (
    tvId: number,
    season: number,
    episode: number,
    preferredQuality: string = '720p',
    preferredLanguage: string = 'en',
    sourceUrl?: string,
    headers?: Record<string, string>
  ): Promise<PlaybackSessionResponse> => {
    const params: Record<string, string | number> = {
      preferred_quality: preferredQuality,
      preferred_language: preferredLanguage,
      season,
      episode,
    };
    const body: Record<string, any> = {};
    if (sourceUrl) {
      body.source_url = sourceUrl;
    }
    if (headers && Object.keys(headers).length > 0) {
      body.headers = headers;
    }

    const response = await api.post(`/streams/tv/${tvId}/session`, body, { params });
    return response.data;
  },

  getProxiedStream: async (movieId: number, sourceUrl: string): Promise<{ proxy_url: string }> => {
    const response = await api.get(
      `/streams/${movieId}/proxy?source_url=${encodeURIComponent(sourceUrl)}`
    );
    return response.data;
  },

  reportIssue: async (movieId: number, sourceUrl: string, issueType: string): Promise<void> => {
    await api.post(
      `/streams/${movieId}/report?source_url=${encodeURIComponent(sourceUrl)}&issue_type=${issueType}`
    );
  },
};

// Auth API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const formData = new FormData();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);

    const response = await axios.post(`${API_BASE_URL}/auth/login`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  register: async (credentials: RegisterCredentials): Promise<User> => {
    const response = await api.post('/auth/register', credentials);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// User API
export const userApi = {
  getProfile: async (): Promise<UserProfile> => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateProfile: async (data: { display_name?: string; avatar_url?: string }): Promise<User> => {
    const response = await api.put('/users/profile', data);
    return response.data;
  },

  getFavorites: async (): Promise<{ favorites: any[] }> => {
    const response = await api.get('/users/favorites');
    return response.data;
  },

  addFavorite: async (movieId: number): Promise<void> => {
    await api.post(`/users/favorites/${movieId}`);
  },

  removeFavorite: async (movieId: number): Promise<void> => {
    await api.delete(`/users/favorites/${movieId}`);
  },
};

// Watch History API
export const watchHistoryApi = {
  getHistory: async (page: number = 1, perPage: number = 20): Promise<WatchHistory[]> => {
    const response = await api.get(`/watch-history/?page=${page}&per_page=${perPage}`);
    return response.data;
  },

  getContinueWatching: async (limit: number = 10): Promise<ContinueWatching[]> => {
    const response = await api.get(`/watch-history/continue-watching?limit=${limit}`);
    return response.data;
  },

  addToHistory: async (data: {
    movie_id: number;
    progress_seconds: number;
    duration_seconds?: number;
    progress_percent: number;
    is_completed: boolean;
  }): Promise<WatchHistory> => {
    const response = await api.post('/watch-history/', data);
    return response.data;
  },

  updateProgress: async (
    movieId: number,
    data: {
      progress_seconds: number;
      duration_seconds?: number;
      progress_percent: number;
      is_completed: boolean;
    }
  ): Promise<WatchHistory> => {
    const response = await api.put(`/watch-history/${movieId}`, data);
    return response.data;
  },

  deleteHistory: async (movieId: number): Promise<void> => {
    await api.delete(`/watch-history/${movieId}`);
  },

  clearHistory: async (): Promise<void> => {
    await api.delete('/watch-history/');
  },
};

export default api;
