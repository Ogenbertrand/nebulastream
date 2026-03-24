import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  SkipBack,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { StreamSource } from '../../types';
import Wordmark from '../Brand/Wordmark';

interface VideoPlayerProps {
  sources: StreamSource[];
  initialProgress?: number;
  onProgress?: (progress: number, duration: number) => void;
  onEnded?: () => void;
  onInternalError?: () => Promise<StreamSource | null> | StreamSource | null;
  autoPlay?: boolean;
  onPlaybackStarted?: () => void;
  posterUrl?: string;
  backdropUrl?: string;
}

type SubtitleOption = {
  id: string;
  label: string;
  lang?: string;
  kind: 'external' | 'hls';
  url?: string;
  trackId?: number;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  sources,
  initialProgress = 0,
  onProgress,
  onEnded,
  onInternalError,
  autoPlay = true,
  onPlaybackStarted,
  posterUrl,
  backdropUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hasSeekedInitial = useRef(false);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedSource, setSelectedSource] = useState<StreamSource | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleOption | null>(null);
  const [hlsLevels, setHlsLevels] = useState<{ level: number; label: string; height?: number }[]>(
    []
  );
  const [hlsCurrentLevel, setHlsCurrentLevel] = useState(-1);
  const [hlsSubtitleTracks, setHlsSubtitleTracks] = useState<
    { id: number; label: string; lang?: string }[]
  >([]);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverLeft, setHoverLeft] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const internalRefreshRef = useRef(false);
  const hasStartedRef = useRef(false);

  const sortedSources = useMemo(() => {
    if (!sources.length) return [];
    const typeOrder: Record<string, number> = { hls: 0, direct: 1, embed: 2 };
    const qualityOrder: Record<string, number> = { '4k': 4, '1080p': 3, '720p': 2, '480p': 1 };
    return [...sources].sort((a, b) => {
      const typeDiff = (typeOrder[a.stream_type] ?? 3) - (typeOrder[b.stream_type] ?? 3);
      if (typeDiff !== 0) return typeDiff;
      const qualityDiff =
        (qualityOrder[b.quality as keyof typeof qualityOrder] || 0) -
        (qualityOrder[a.quality as keyof typeof qualityOrder] || 0);
      if (qualityDiff !== 0) return qualityDiff;
      return (b.reliability_score || 0) - (a.reliability_score || 0);
    });
  }, [sources]);

  // Prefer direct streams first
  useEffect(() => {
    if (sortedSources.length === 0) {
      setSelectedSource(null);
      return;
    }
    if (!selectedSource || !sortedSources.find((source) => source.url === selectedSource.url)) {
      setSelectedSource(sortedSources[0]);
    }
  }, [sortedSources, selectedSource]);

  useEffect(() => {
    setSelectedSubtitle(null);
    setHlsLevels([]);
    setHlsCurrentLevel(-1);
    setHlsSubtitleTracks([]);
    setPlayerError(null);
    setIsBuffering(false);
    setIsInitializing(false);
    hasStartedRef.current = false;
    if (!autoPlay) {
      setIsPlaying(false);
    }
  }, [selectedSource?.url, autoPlay]);

  // Hide controls after inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying && !showSettings) {
          setShowControls(false);
        }
      }, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      clearTimeout(timeout);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [isPlaying, showSettings]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const isEmbedSource = selectedSource?.stream_type === 'embed';
  const isHlsSource = selectedSource?.stream_type === 'hls';

  const handlePlayerError = useCallback(() => {
    setIsBuffering(false);
    setIsInitializing(false);

    const applyFallback = () => {
      const currentIndex = sortedSources.findIndex((source) => source.url === selectedSource?.url);
      const isInternal = selectedSource?.provider_name === 'NebulaStream';
      const candidates = currentIndex >= 0 ? sortedSources.slice(currentIndex + 1) : [];
      const nextSource = candidates.find((source) => {
        if (isInternal && source.stream_type === 'embed') {
          return false;
        }
        return true;
      });

      if (nextSource) {
        setSelectedSource(nextSource);
        return;
      }

      setPlayerError('This stream could not be played. Try another source.');
    };

    const isInternal = selectedSource?.provider_name === 'NebulaStream';
    if (isInternal && onInternalError && !internalRefreshRef.current) {
      internalRefreshRef.current = true;
      Promise.resolve(onInternalError())
        .then((newSource) => {
          internalRefreshRef.current = false;
          if (newSource) {
            setSelectedSource(newSource);
            return;
          }
          applyFallback();
        })
        .catch(() => {
          internalRefreshRef.current = false;
          applyFallback();
        });
      return;
    }

    applyFallback();
  }, [sortedSources, selectedSource, onInternalError]);

  // Initialize stream playback when source changes
  useEffect(() => {
    if (!selectedSource || isEmbedSource) return;
    const video = videoRef.current;
    if (!video) return;

    setIsInitializing(true);
    setIsBuffering(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();
    video.removeAttribute('src');
    video.load();

    if (isHlsSource) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            handlePlayerError();
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const levelMap = new Map<number, { level: number; label: string; height?: number }>();
          hls.levels.forEach((level, index) => {
            const height = level.height || 0;
            const label = height ? `${height}p` : level.name || `Level ${index + 1}`;
            const key = height || index + 1000;
            if (!levelMap.has(key)) {
              levelMap.set(key, { level: index, label, height });
            }
          });
          const options = Array.from(levelMap.values()).sort(
            (a, b) => (b.height || 0) - (a.height || 0)
          );
          setHlsLevels(options);
          setHlsCurrentLevel(hls.currentLevel);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          setHlsCurrentLevel(data.level);
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
          const tracks = data.subtitleTracks || hls.subtitleTracks || [];
          setHlsSubtitleTracks(
            tracks.map((track, index) => ({
              id: index,
              label: track.name || track.lang || `Subtitle ${index + 1}`,
              lang: track.lang,
            }))
          );
        });

        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(selectedSource.url);
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = selectedSource.url;
      } else {
        handlePlayerError();
        return;
      }
    } else {
      video.src = selectedSource.url;
    }

    video.preload = 'metadata';
    video.load();

    if (isPlaying && autoPlay) {
      video.play().catch(() => {
        setIsPlaying(false);
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedSource, isEmbedSource, isHlsSource, isPlaying, autoPlay, handlePlayerError]);

  useEffect(() => {
    if (isEmbedSource) return;
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume;
    video.muted = isMuted;
    video.playbackRate = playbackRate;
  }, [isEmbedSource, isMuted, playbackRate, volume]);

  useEffect(() => {
    if (isEmbedSource) return;
    const video = videoRef.current;
    if (!video) return;

    if (!autoPlay) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    if (autoPlay && !isPlaying) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [autoPlay, isEmbedSource, isPlaying]);

  useEffect(() => {
    if (isEmbedSource) return;
    const video = videoRef.current;
    if (!video) return;

    // Clear any previously injected external tracks
    const existingTracks = video.querySelectorAll('track[data-nebula-subtitle]');
    existingTracks.forEach((track) => track.remove());

    if (selectedSubtitle?.kind === 'hls') {
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = selectedSubtitle.trackId ?? -1;
      }
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = -1;
    }

    if (selectedSubtitle?.kind === 'external' && selectedSubtitle.url) {
      const track = document.createElement('track');
      track.setAttribute('data-nebula-subtitle', 'true');
      track.kind = 'subtitles';
      track.label = selectedSubtitle.label;
      track.srclang = selectedSubtitle.lang || 'en';
      track.src = selectedSubtitle.url;
      track.default = true;
      video.appendChild(track);
      if (track.track) {
        track.track.mode = 'showing';
      }
    }
  }, [selectedSubtitle, isEmbedSource]);

  const handlePlayPause = () => {
    if (isEmbedSource) return;
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const toggleSettings = () => {
    setShowSettings((prev) => !prev);
    setShowControls(true);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setProgress(video.currentTime);
    onProgress?.(video.currentTime, video.duration || duration);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);

    if (!hasSeekedInitial.current && initialProgress > 0) {
      hasSeekedInitial.current = true;
      video.currentTime = initialProgress;
      return;
    }

    if (progress > 0) {
      video.currentTime = progress;
    }
  };

  const handleSeek = (newTime: number) => {
    const video = videoRef.current;
    if (!video) return;
    setProgress(newTime);
    video.currentTime = newTime;
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const totalDuration = video.duration || duration;
    const newTime = Math.max(0, Math.min(totalDuration, video.currentTime + seconds));
    video.currentTime = newTime;
    setProgress(newTime);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const availableSubtitles: SubtitleOption[] = useMemo(() => {
    if (hlsSubtitleTracks.length > 0) {
      return hlsSubtitleTracks.map((track) => ({
        id: `hls-${track.id}`,
        label: track.label,
        lang: track.lang,
        kind: 'hls',
        trackId: track.id,
      }));
    }
    const external = selectedSource?.subtitles || [];
    return external.map((subtitle) => ({
      id: `ext-${subtitle.url}`,
      label: subtitle.label || subtitle.lang,
      lang: subtitle.lang,
      kind: 'external',
      url: subtitle.url,
    }));
  }, [hlsSubtitleTracks, selectedSource]);
  const sourceQualityOptions = useMemo(() => {
    if (!selectedSource) return [];
    const sameType = sortedSources.filter(
      (source) => source.stream_type === selectedSource.stream_type
    );
    const seen = new Set<string>();
    return sameType.filter((source) => {
      if (seen.has(source.quality)) return false;
      seen.add(source.quality);
      return true;
    });
  }, [sortedSources, selectedSource]);
  const qualityOptions = useMemo(() => {
    if (isHlsSource && hlsLevels.length > 0) {
      return [
        { value: 'auto', label: 'Auto' },
        ...hlsLevels.map((level) => ({
          value: `hls-${level.level}`,
          label: level.label,
        })),
      ];
    }
    if (sourceQualityOptions.length > 1) {
      return sourceQualityOptions.map((source) => ({
        value: source.quality,
        label: source.quality,
      }));
    }
    return [];
  }, [isHlsSource, hlsLevels, sourceQualityOptions]);
  const currentQualityValue = useMemo(() => {
    if (isHlsSource && hlsLevels.length > 0) {
      return hlsCurrentLevel === -1 ? 'auto' : `hls-${hlsCurrentLevel}`;
    }
    return selectedSource?.quality || '';
  }, [isHlsSource, hlsLevels.length, hlsCurrentLevel, selectedSource?.quality]);
  const previewImage = backdropUrl || posterUrl;

  const handleQualityChange = (value: string) => {
    if (isHlsSource && hlsRef.current && hlsLevels.length > 0) {
      const level = value === 'auto' ? -1 : parseInt(value.replace('hls-', ''), 10);
      hlsRef.current.currentLevel = level;
      setHlsCurrentLevel(level);
      return;
    }
    const nextSource = sourceQualityOptions.find((source) => source.quality === value);
    if (nextSource) {
      setSelectedSource(nextSource);
    }
  };

  const handleProgressHover = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
    const percent = offsetX / rect.width;
    const time = percent * duration;
    const previewWidth = 176;
    const maxLeft = Math.max(0, rect.width - previewWidth);
    const clampedLeft = Math.min(Math.max(offsetX - previewWidth / 2, 0), maxLeft);
    setHoverTime(time);
    setHoverLeft(clampedLeft);
  };

  const handleProgressLeave = () => {
    setHoverTime(null);
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
    const percent = offsetX / rect.width;
    const time = percent * duration;
    handleSeek(time);
  };

  if (!selectedSource) {
    return (
      <div className="w-full aspect-video bg-dark-900 flex items-center justify-center rounded-lg">
        <p className="text-gray-400">No stream sources available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-none sm:rounded-3xl overflow-hidden group player-container"
    >
      {isEmbedSource ? (
        <iframe
          title={`Stream - ${selectedSource.provider_name}`}
          src={selectedSource.url}
          className="w-full h-full object-cover"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          poster={backdropUrl || posterUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsBuffering(true)}
          onCanPlay={() => {
            setIsBuffering(false);
            setIsInitializing(false);
          }}
          onPlaying={() => {
            setIsBuffering(false);
            if (!hasStartedRef.current) {
              hasStartedRef.current = true;
              onPlaybackStarted?.();
            }
          }}
          onEnded={onEnded}
          onError={handlePlayerError}
          playsInline
        />
      )}

      {!isEmbedSource && (
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-300 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-full bg-black/50">
                <Wordmark size="sm" className="tracking-[0.24em]" />
              </div>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              ) : (
                <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white ml-1" />
              )}
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
            <div
              ref={progressBarRef}
              onMouseMove={handleProgressHover}
              onMouseLeave={handleProgressLeave}
              onClick={handleProgressClick}
              className="relative h-1.5 sm:h-2 bg-white/20 rounded-full cursor-pointer"
            >
              <div
                className="absolute top-0 left-0 h-full bg-nebula-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg"
                style={{ left: `calc(${progressPercent}% - 6px)` }}
              />

              {hoverTime !== null && (
                <div className="absolute -top-28" style={{ left: hoverLeft }}>
                  <div className="w-44 rounded-xl overflow-hidden border border-white/10 bg-black/80 backdrop-blur-xl shadow-xl">
                    {previewImage ? (
                      <img src={previewImage} alt="Preview" className="w-full h-24 object-cover" />
                    ) : (
                      <div className="w-full h-24 bg-dark-800" />
                    )}
                    <div className="px-3 py-2 text-xs text-white/80">{formatTime(hoverTime)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <button onClick={handlePlayPause} className="text-white hover:text-nebula-400">
                  {isPlaying ? (
                    <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </button>

                <button
                  onClick={() => handleSkip(-10)}
                  className="text-white hover:text-nebula-400"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button onClick={() => handleSkip(10)} className="text-white hover:text-nebula-400">
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <div className="flex items-center gap-2">
                  <button onClick={handleMuteToggle} className="text-white hover:text-nebula-400">
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 sm:w-24 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <span className="text-white/70 text-xs sm:text-sm">
                  {formatTime(progress)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSettings}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                >
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </button>

                <button onClick={handleFullscreen} className="text-white hover:text-nebula-400">
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEmbedSource && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-black/60">
              <Wordmark size="sm" className="tracking-[0.24em]" />
            </div>
          </div>
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex items-center gap-2 pointer-events-auto">
            <a
              href={selectedSource.url}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 transition text-xs text-white"
            >
              Open
            </a>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/70 pointer-events-none">
            <span>Use the provider controls inside the player.</span>
            <span>If it doesn’t start, switch sources.</span>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute left-3 right-3 bottom-16 sm:bottom-24 sm:left-auto sm:right-6 glass-panel rounded-2xl p-4 w-auto sm:w-60 max-h-[60vh] overflow-auto z-50">
          <div className="space-y-4 text-sm text-white/80">
            {qualityOptions.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">Quality</p>
                <select
                  value={currentQualityValue}
                  onChange={(e) => handleQualityChange(e.target.value)}
                  className="w-full bg-dark-900/80 text-white rounded-lg px-3 py-2 border border-white/10"
                >
                  {qualityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {sortedSources.length > 1 && (
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">Source</p>
                <select
                  value={selectedSource.url}
                  onChange={(e) => {
                    const source = sortedSources.find((s) => s.url === e.target.value);
                    if (source) setSelectedSource(source);
                  }}
                  className="w-full bg-dark-900/80 text-white rounded-lg px-3 py-2 border border-white/10"
                >
                  {sortedSources.map((source) => (
                    <option key={source.url} value={source.url}>
                      {source.quality} - {source.provider_name} ({source.stream_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isEmbedSource && (
              <>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">Subtitles</p>
                  <select
                    value={selectedSubtitle?.id || 'off'}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'off') {
                        setSelectedSubtitle(null);
                      } else {
                        const subtitle = availableSubtitles.find((s) => s.id === value) || null;
                        setSelectedSubtitle(subtitle);
                      }
                    }}
                    className="w-full bg-dark-900/80 text-white rounded-lg px-3 py-2 border border-white/10"
                  >
                    <option value="off">Off</option>
                    {availableSubtitles.map((subtitle) => (
                      <option key={subtitle.id} value={subtitle.id}>
                        {subtitle.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">Speed</p>
                  <select
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                    className="w-full bg-dark-900/80 text-white rounded-lg px-3 py-2 border border-white/10"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {playerError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl bg-black/70 border border-white/10 px-6 py-4 text-center text-white/80">
            {playerError}
          </div>
        </div>
      )}

      {(isBuffering || isInitializing) && !isEmbedSource && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 border border-white/10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
