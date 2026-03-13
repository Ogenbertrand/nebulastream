import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import VideoPlayer from '../../components/VideoPlayer/VideoPlayer';
import Loading from '../../components/Loading/Loading';
import { moviesApi, streamsApi, watchHistoryApi } from '../../services/api';
import { Movie, StreamSource } from '../../types';
import toast from 'react-hot-toast';

const Player: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialProgress, setInitialProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Progress tracking
  const progressRef = React.useRef({ progress: 0, duration: 0 });
  const saveIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const saveProgress = useCallback(async () => {
    if (!id || !movie) return;

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
  }, [id, movie]);

  const loadPlayerData = useCallback(
    async (movieId: number) => {
      try {
        setLoading(true);
        setError(null);

        // Fetch movie details and streams in parallel
        const [movieData, streamData, historyData] = await Promise.all([
          moviesApi.getDetail(movieId),
          streamsApi.getStreams(movieId),
          watchHistoryApi.getHistory(1, 1).catch(() => []),
        ]);

        setMovie(movieData);
        setSources(streamData.sources);

        // Find existing progress
        const existingEntry = historyData.find((h) => h.movie_id === movieId);
        if (existingEntry && !existingEntry.is_completed) {
          setInitialProgress(existingEntry.progress_seconds);
        }

        // Start progress saving interval
        if (saveIntervalRef.current) {
          clearInterval(saveIntervalRef.current);
        }
        saveIntervalRef.current = setInterval(saveProgress, 30000); // Save every 30 seconds
      } catch (err) {
        console.error('Failed to load player data:', err);
        setError('Failed to load video. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [saveProgress]
  );

  useEffect(() => {
    if (id) {
      loadPlayerData(parseInt(id));
    }

    return () => {
      // Save progress on unmount
      saveProgress();
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [id, loadPlayerData, saveProgress]);

  const handleProgress = (progress: number, duration: number) => {
    progressRef.current = { progress, duration };
  };

  const handleEnded = async () => {
    if (!id) return;

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
            We couldn't find any streaming sources for this movie.
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
        <title>{movie ? `Watching ${movie.title}` : 'Now Playing'} - NebulaStream</title>
      </Helmet>

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

          <div className="min-h-screen flex items-center justify-center px-4 pb-20 sm:pb-24 pt-20">
            <div className="w-full max-w-6xl 2xl:max-w-screen-2xl mx-auto">
              <VideoPlayer
                sources={sources}
                initialProgress={initialProgress}
                onProgress={handleProgress}
                onEnded={handleEnded}
                posterUrl={movie?.poster_path}
                backdropUrl={movie?.backdrop_path}
              />
            </div>
          </div>

          {movie && (
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 sm:p-6">
              <div className="max-w-6xl 2xl:max-w-screen-2xl mx-auto">
                <h1 className="text-lg sm:text-2xl font-display font-bold text-white">
                  {movie.title}
                </h1>
                {movie.overview && (
                  <p className="text-white/60 mt-2 line-clamp-2 max-w-2xl text-sm sm:text-base">
                    {movie.overview}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Player;
