// Movie types
export interface Movie {
  id: number;
  tmdb_id?: number;
  imdb_id?: string;
  title: string;
  original_title?: string;
  overview?: string;
  tagline?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  original_language?: string;
  genres: Genre[];
  cast?: CastMember[];
  crew?: CrewMember[];
  trailers?: Trailer[];
  similar?: MovieListItem[];
  seasons?: SeasonSummary[];
}

export interface MovieListItem {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average: number;
  release_date?: string;
  genre_ids: number[];
  media_type?: 'movie' | 'tv';
}

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path?: string;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path?: string;
}

export interface Trailer {
  key: string;
  name: string;
  site: string;
  type: string;
}

export interface SeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  overview?: string;
  poster_path?: string;
  air_date?: string;
}

export interface Episode {
  id: number;
  name: string;
  overview?: string;
  episode_number: number;
  season_number: number;
  still_path?: string;
  air_date?: string;
  runtime?: number;
}

// Stream types
export interface StreamSource {
  url: string;
  quality: string;
  stream_type: string;
  language: string;
  subtitles: Subtitle[];
  headers?: Record<string, string>;
  provider_name: string;
  reliability_score: number;
}

export interface Subtitle {
  lang: string;
  url: string;
  label: string;
}

export interface StreamResponse {
  movie_id: number;
  sources: StreamSource[];
  subtitles: Subtitle[];
}

export interface PlaybackSessionResponse {
  session_id: string;
  manifest_url: string;
  status: string;
  ready: boolean;
  expires_at: string;
}

// User types
export interface User {
  id: number;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login?: string;
}

export interface UserProfile extends User {
  watch_count: number;
  favorite_count: number;
  total_watch_time: number;
}

// Watch history types
export interface WatchHistory {
  id: number;
  user_id: number;
  movie_id: number;
  progress_seconds: number;
  duration_seconds?: number;
  progress_percent: number;
  is_completed: boolean;
  watched_at: string;
  updated_at: string;
  movie?: MovieListItem;
}

export interface ContinueWatching {
  movie: MovieListItem;
  progress_seconds: number;
  duration_seconds?: number;
  progress_percent: number;
  last_watched_at: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
  display_name?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// API response types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ApiError {
  error: boolean;
  status: number;
  message: string;
}
