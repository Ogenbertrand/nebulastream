import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import Loading from '../../components/Loading/Loading';
import MovieRow from '../../components/MovieRow/MovieRow';
import { moviesApi, streamsApi, tvApi, watchHistoryApi } from '../../services/api';
import { Episode, Movie, StreamResponse, StreamSource } from '../../types';
import toast from 'react-hot-toast';
import IntroScreen from '../../components/Intro/IntroScreen';
import { introConfig } from '../../config/introConfig';

const VideoPlayer = React.lazy(() => import('../../components/VideoPlayer/VideoPlayer'));

const Player: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const renderCastCard = (actor: any) => (
    <div key={actor.id} className="text-center">
      <div className="aspect-square rounded-2xl overflow-hidden mb-2 bg-dark-800 border border-white/5">
        {actor.profile_path ? (
          <img
            src={actor.profile_path}
            alt={actor.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/40 text-xs">No Photo</span>
          </div>
        )}
      </div>
      <p className="text-white text-sm font-medium line-clamp-1">{actor.name}</p>
      <p className="text-white/50 text-xs line-clamp-1">{actor.character}</p>
    </div>
  );

  const searchParams = new URLSearchParams(location.search);
  const isTv = location.pathname.includes('/watch/tv');
  const seasonParam = Number(searchParams.get('season') || 1);
  const episodeParam = Number(searchParams.get('episode') || 1);
  const seasonNumber = Number.isFinite(seasonParam) && seasonParam > 0 ? seasonParam : 1;
  const episodeNumber = Number.isFinite(episodeParam) && episodeParam > 0 ? episodeParam : 1;

  const [movie, setMovie] = useState<Movie | null>(null);
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialProgress, setInitialProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [playbackState, setPlaybackState] = useState<'idle' | 'intro' | 'loading' | 'playing'>(
    'idle'
  );
  const internalSeedRef = useRef<{
    sourceUrl: string;
    quality: string;
    language: string;
    subtitles: StreamSource['subtitles'];
    isTv?: boolean;
    season?: number;
    episode?: number;
  } | null>(null);
  const internalRefreshRef = useRef(false);
  const lastInternalRefreshRef = useRef(0);

  // Progress tracking
  const progressRef = React.useRef({ progress: 0, duration: 0 });
  const saveIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const movieRef = useRef<Movie | null>(null);

  useEffect(() => {
    movieRef.current = movie;
  }, [movie]);

  const saveProgress = useCallback(async () => {
    if (!id || !movieRef.current || isTv) return;

    const { progress, duration } = progressRef.current;
    if (duration === 0) return;

    const progressPercent = (progress / duration) * 100;
    const isCompleted = progressPercent >= 95;

    try {
      await watchHistoryApi.updateProgress(parseInt(id), {
        progress_seconds: Math.floor(progress),
        duration_seconds: Math.floor(duration),
        progress_percent: progressPercent,
        is_completed: isCompleted,
      });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [id, isTv]);

  const loadPlayerData = useCallback(
    async (contentId: number) => {
      try {
        setLoading(true);
        setPlaybackState('loading');
        setError(null);
        setEpisode(null);
        internalSeedRef.current = null;
        setInitialProgress(0);

        // Fetch movie details and streams in parallel
        const preferredQuality = '720p';
        const movieData = isTv
          ? await tvApi.getDetail(contentId)
          : await moviesApi.getDetail(contentId);
        const historyData = isTv ? [] : await watchHistoryApi.getHistory(1, 1).catch(() => []);
        let streamData: StreamResponse;
        try {
          streamData = isTv
            ? await streamsApi.getTvStreams(
                contentId,
                seasonNumber,
                episodeNumber,
                preferredQuality
              )
            : await streamsApi.getStreams(contentId, preferredQuality);
        } catch (streamError) {
          console.warn('Failed to fetch streams:', streamError);
          streamData = { movie_id: contentId, sources: [], subtitles: [] };
        }

        setMovie(movieData);
        if (isTv) {
          try {
            const episodes = await tvApi.getSeason(contentId, seasonNumber);
            const selectedEpisode =
              episodes?.find((item: Episode) => item.episode_number === episodeNumber) || null;
            setEpisode(selectedEpisode);
          } catch (episodeError) {
            console.warn('Failed to fetch episode info:', episodeError);
          }
        }
        let resolvedSources = streamData.sources;

        const token = localStorage.getItem('access_token');
        const hasInternalSource = resolvedSources.some(
          (source) => source.provider_name === 'NebulaStream'
        );
        if (token && !hasInternalSource) {
          try {
            const hlsCandidates = resolvedSources.filter((source) => source.stream_type === 'hls');
            const candidateSource =
              hlsCandidates
                .sort((a, b) => {
                  const headerScore =
                    Number(Boolean(b.headers && Object.keys(b.headers).length > 0)) -
                    Number(Boolean(a.headers && Object.keys(a.headers).length > 0));
                  if (headerScore !== 0) return headerScore;
                  const reliability = (b.reliability_score || 0) - (a.reliability_score || 0);
                  if (reliability !== 0) return reliability;
                  const qualityOrder: Record<string, number> = {
                    '4k': 4,
                    '1080p': 3,
                    '720p': 2,
                    '480p': 1,
                  };
                  return (
                    (qualityOrder[b.quality as keyof typeof qualityOrder] || 0) -
                    (qualityOrder[a.quality as keyof typeof qualityOrder] || 0)
                  );
                })
                .shift() || null;
            if (!candidateSource) {
              console.info('No HLS source available for internal session.');
              internalSeedRef.current = null;
            } else {
              const session = isTv
                ? await streamsApi.createTvSession(
                    contentId,
                    seasonNumber,
                    episodeNumber,
                    preferredQuality,
                    'en',
                    candidateSource.url,
                    candidateSource.headers
                  )
                : await streamsApi.createSession(
                    contentId,
                    preferredQuality,
                    'en',
                    candidateSource.url,
                    candidateSource.headers
                  );
              if (session?.ready) {
                internalSeedRef.current = {
                  sourceUrl: candidateSource.url,
                  quality: preferredQuality,
                  language: 'en',
                  subtitles: candidateSource.subtitles || [],
                  isTv,
                  season: seasonNumber,
                  episode: episodeNumber,
                };
                const internalSource: StreamSource = {
                  url: session.manifest_url,
                  quality: preferredQuality,
                  stream_type: 'hls',
                  language: 'en',
                  subtitles: candidateSource.subtitles || [],
                  provider_name: 'NebulaStream',
                  reliability_score: 95,
                };
                resolvedSources = [
                  internalSource,
                  ...resolvedSources.filter((source) => source.url !== internalSource.url),
                ];
              }
            }
          } catch (sessionError) {
            console.warn('Failed to create internal session:', sessionError);
            internalSeedRef.current = null;
          }
        }

        setSources(resolvedSources);

        if (introConfig.enableIntro) {
          setPlaybackState('intro');
        } else {
          setPlaybackState('loading');
        }

        // Find existing progress
        if (!isTv) {
          const existingEntry = historyData.find((h) => h.movie_id === contentId);
          if (existingEntry && !existingEntry.is_completed) {
            setInitialProgress(existingEntry.progress_seconds);
          }
        }

        // Start progress saving interval for movies only
        if (saveIntervalRef.current) {
          clearInterval(saveIntervalRef.current);
        }
        if (!isTv) {
          saveIntervalRef.current = setInterval(saveProgress, 30000); // Save every 30 seconds
        }
      } catch (err) {
        console.error('Failed to load player data:', err);
        setError('Failed to load video. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [episodeNumber, isTv, saveProgress, seasonNumber]
  );

  const refreshInternalSession = useCallback(async (): Promise<StreamSource | null> => {
    if (!id || internalRefreshRef.current) {
      return null;
    }
    const seed = internalSeedRef.current;
    const token = localStorage.getItem('access_token');
    if (!seed || !token) {
      return null;
    }
    const now = Date.now();
    if (now - lastInternalRefreshRef.current < 5000) {
      return null;
    }

    internalRefreshRef.current = true;
    try {
      const session =
        seed.isTv && seed.season && seed.episode
          ? await streamsApi.createTvSession(
              parseInt(id),
              seed.season,
              seed.episode,
              seed.quality,
              seed.language,
              seed.sourceUrl
            )
          : await streamsApi.createSession(
              parseInt(id),
              seed.quality,
              seed.language,
              seed.sourceUrl
            );
      if (session?.ready) {
        const internalSource: StreamSource = {
          url: session.manifest_url,
          quality: seed.quality,
          stream_type: 'hls',
          language: seed.language,
          subtitles: seed.subtitles || [],
          provider_name: 'NebulaStream',
          reliability_score: 95,
        };
        setSources((prev) => {
          const filtered = prev.filter((source) => source.provider_name !== 'NebulaStream');
          return [internalSource, ...filtered];
        });
        lastInternalRefreshRef.current = now;
        return internalSource;
      }
    } catch (error) {
      console.warn('Failed to refresh internal session:', error);
    } finally {
      internalRefreshRef.current = false;
    }
    return null;
  }, [id]);

  useEffect(() => {
    if (id) {
      loadPlayerData(parseInt(id));
    }

    return () => {
      // Save progress on unmount
      if (!isTv) {
        saveProgress();
      }
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [id, isTv, loadPlayerData, saveProgress]);

  const handleProgress = (progress: number, duration: number) => {
    progressRef.current = { progress, duration };
  };

  const handleEnded = async () => {
    if (!id || isTv) return;

    // Mark as completed
    try {
      await watchHistoryApi.updateProgress(parseInt(id), {
        progress_seconds: progressRef.current.duration,
        duration_seconds: Math.floor(progressRef.current.duration),
        progress_percent: 100,
        is_completed: true,
      });
      toast.success('Movie completed!');
    } catch (error) {
      console.error('Failed to mark as completed:', error);
    }
  };

  if (loading) {
    return <Loading fullScreen message="Loading video..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Error</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => navigate(-1)} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">No Streams Available</h1>
          <p className="text-gray-400 mb-6">
            We couldn't find any streaming sources for this {isTv ? 'episode' : 'movie'}.
          </p>
          <button onClick={() => navigate(-1)} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {movie
            ? `Watching ${movie.title}${isTv ? ` • S${seasonNumber}E${episodeNumber}` : ''}`
            : 'Now Playing'}{' '}
          - NebulaStream
        </title>
      </Helmet>

      {playbackState === 'intro' && (
        <IntroScreen
          durationMs={introConfig.introDuration}
          soundEnabled={introConfig.soundEnabled}
          soundUrl={introConfig.soundUrl}
          onComplete={() => setPlaybackState('loading')}
        />
      )}

      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        {movie?.backdrop_path && (
          <div className="absolute inset-0">
            <img
              src={movie.backdrop_path}
              alt={movie.title}
              className="w-full h-full object-cover opacity-30 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-dark-950/80 to-dark-950" />
          </div>
        )}

        <div className="relative z-10">
          <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-white hover:text-nebula-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              <span className="text-sm sm:text-base">Back</span>
            </button>
          </div>

          <div className="min-h-screen flex flex-col items-stretch justify-start px-0 sm:px-4 pb-20 sm:pb-24 pt-20 sm:pt-20">
            <div className="w-screen sm:w-full max-w-none sm:max-w-6xl 2xl:max-w-screen-2xl sm:mx-auto px-0 mt-2 sm:mt-0">
              <Suspense fallback={<Loading message="Loading player..." />}>
                <VideoPlayer
                  key={`${id}-${isTv ? `tv-${seasonNumber}-${episodeNumber}` : 'movie'}`}
                  sources={sources}
                  initialProgress={initialProgress}
                  onProgress={handleProgress}
                  onEnded={handleEnded}
                  onInternalError={refreshInternalSession}
                  autoPlay={playbackState !== 'intro'}
                  onPlaybackStarted={() => setPlaybackState('playing')}
                  posterUrl={movie?.poster_path}
                  backdropUrl={movie?.backdrop_path}
                />
              </Suspense>
            </div>

            {movie && (
              <div className="w-screen sm:w-full max-w-none sm:max-w-6xl 2xl:max-w-screen-2xl sm:mx-auto px-4 sm:px-0 mt-5 sm:mt-8">
                <div className="rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md overflow-hidden">
                  <div className="p-4 sm:p-6">
                    <div className="flex gap-4">
                      {movie.poster_path ? (
                        <img
                          src={movie.poster_path}
                          alt={movie.title}
                          className="w-20 sm:w-28 h-28 sm:h-40 object-cover rounded-xl bg-dark-900"
                        />
                      ) : (
                        <div className="w-20 sm:w-28 h-28 sm:h-40 rounded-xl bg-dark-900" />
                      )}

                      <div className="min-w-0 flex-1">
                        <h1 className="text-lg sm:text-2xl font-display font-bold text-white truncate">
                          {movie.title}
                        </h1>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-white/60">
                          {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
                          {movie.runtime && <span>{movie.runtime} min</span>}
                          {movie.vote_average !== undefined && (
                            <span>{Number(movie.vote_average || 0).toFixed(1)} / 10</span>
                          )}
                          {isTv && (
                            <span>
                              S{seasonNumber}E{episodeNumber}
                              {episode?.name ? ` · ${episode.name}` : ''}
                            </span>
                          )}
                        </div>

                        {movie.genres && movie.genres.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {movie.genres.slice(0, 4).map((genre) => (
                              <span
                                key={genre.id}
                                className="px-2.5 py-1 rounded-full bg-white/10 text-xs text-white/70"
                              >
                                {genre.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {(!isTv && movie.overview) && (
                      <p className="mt-4 text-sm sm:text-base text-white/70 leading-relaxed">
                        {movie.overview}
                      </p>
                    )}
                    {(isTv && episode?.overview) && (
                      <p className="mt-4 text-sm sm:text-base text-white/70 leading-relaxed">
                        {episode.overview}
                      </p>
                    )}

                    {movie.cast && movie.cast.length > 0 && (
                      <div className="mt-7 sm:mt-10">
                        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-5">Cast</h2>
                        <div className="overflow-x-auto pb-3 -mx-1">
                          <div className="grid grid-rows-2 auto-cols-[140px] grid-flow-col gap-3 px-1">
                            {movie.cast.slice(0, 12).map((actor) => renderCastCard(actor))}
                          </div>
                        </div>
                      </div>
                    )}

                    {movie.similar && movie.similar.length > 0 && (
                      <div className="mt-7 sm:mt-10">
                        <MovieRow title="Similar Movies" movies={movie.similar} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Player;
