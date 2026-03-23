import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Star, Clock, Calendar, ArrowLeft, Share2 } from 'lucide-react';
import { tvApi } from '../../services/api';
import { Episode, Movie, MovieListItem, SeasonSummary } from '../../types';
import MovieRow from '../../components/MovieRow/MovieRow';
import Loading from '../../components/Loading/Loading';
import toast from 'react-hot-toast';

const TVDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [show, setShow] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<MovieListItem[]>([]);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const episodesRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (id) {
      fetchShowDetail(parseInt(id));
    }
  }, [id]);

  useEffect(() => {
    if (!id || selectedSeason === null) return;
    fetchSeasonEpisodes(parseInt(id), selectedSeason);
  }, [id, selectedSeason]);

  const fetchShowDetail = async (tvId: number) => {
    try {
      setLoading(true);
      const data = await tvApi.getDetail(tvId);
      setShow(data);
      const availableSeasons = (data.seasons || []).filter((season) => season.season_number > 0);
      const seasonList = availableSeasons.length ? availableSeasons : data.seasons || [];
      setSeasons(seasonList);
      if (seasonList.length > 0) {
        setSelectedSeason(seasonList[0].season_number);
      }

      const recs = await tvApi.getRecommendations(tvId);
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to fetch TV detail:', error);
      toast.error('Failed to load TV details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasonEpisodes = async (tvId: number, seasonNumber: number) => {
    try {
      setLoadingEpisodes(true);
      const data = await tvApi.getSeason(tvId, seasonNumber);
      setEpisodes(data || []);
    } catch (error) {
      console.error('Failed to fetch episodes:', error);
      toast.error('Failed to load episodes');
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handlePlayEpisode = (seasonNumber: number, episodeNumber: number) => {
    if (!id) return;
    navigate(`/watch/tv/${id}?season=${seasonNumber}&episode=${episodeNumber}`);
  };

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">TV Show Not Found</h1>
          <Link to="/" className="btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const year = show.release_date ? new Date(show.release_date).getFullYear() : null;

  return (
    <>
      <Helmet>
        <title>{show.title} - NebulaStream</title>
        <meta name="description" content={show.overview || `Watch ${show.title}`} />
      </Helmet>

      <div className="min-h-screen bg-dark-950">
        <button
          onClick={() => navigate(-1)}
          className="fixed top-4 left-4 sm:left-6 z-30 w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white hover:bg-white/10 transition"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <div className="relative h-[55vh] sm:h-[68vh] lg:h-[78vh] 2xl:h-[86vh] min-h-[380px] sm:min-h-[500px]">
          <div className="absolute inset-0">
            {show.backdrop_path ? (
              <img
                src={show.backdrop_path}
                alt={show.title}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-dark-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/35 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/30 to-transparent" />
          </div>

          <div className="absolute right-4 top-4 z-20 w-20 sm:w-24 lg:hidden pointer-events-none">
            <div className="aspect-poster rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              {show.poster_path ? (
                <img
                  src={show.poster_path}
                  alt={show.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-dark-800 flex items-center justify-center">
                  <span className="text-white/40 text-xs">No Image</span>
                </div>
              )}
            </div>
          </div>

          <div className="relative h-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 flex items-end pb-0 sm:pb-10 lg:pb-12">
            <div className="relative flex flex-col lg:flex-row gap-6 sm:gap-10 items-start lg:items-end w-full">
              <div className="hidden lg:block w-60 2xl:w-72">
                <div className="aspect-poster rounded-2xl overflow-hidden shadow-2xl">
                  {show.poster_path ? (
                    <img
                      src={show.poster_path}
                      alt={show.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full bg-dark-800 flex items-center justify-center">
                      <span className="text-white/40">No Image</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="max-w-2xl 2xl:max-w-3xl w-full">
                <h1 className="text-3xl sm:text-5xl 2xl:text-6xl font-display font-bold text-white mb-2 sm:mb-4">
                  {show.title}
                </h1>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-white/70 mb-3 sm:mb-4">
                  <span className="flex items-center gap-1 text-green-400">
                    <Star className="w-4 h-4 fill-current" />
                    {show.vote_average.toFixed(1)}
                  </span>
                  {year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {year}
                    </span>
                  )}
                  {show.runtime && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {show.runtime}m
                    </span>
                  )}
                  {show.number_of_seasons && (
                    <span>{show.number_of_seasons} seasons</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                  {show.genres?.map((genre) => (
                    <span
                      key={genre.id}
                      className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <button
                    onClick={() => episodesRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="btn-primary"
                  >
                    Episodes
                  </button>
                  <button className="btn-ghost">
                    <Share2 className="w-5 h-5 mr-2" />
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-10 sm:py-12 pb-28 md:pb-12">
          {(show.tagline || show.overview) && (
            <section className="mb-10">
              <div className="glass-panel rounded-3xl p-5 sm:p-7">
                <h2 className="text-white font-semibold text-lg mb-3">Story</h2>
                {show.tagline && <p className="text-white/70 italic mb-3">{show.tagline}</p>}
                {show.overview && (
                  <p className="text-white/80 leading-relaxed text-sm sm:text-base">
                    {show.overview}
                  </p>
                )}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            <div className="lg:col-span-2 space-y-10">
              <section ref={episodesRef}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <h2 className="text-2xl font-semibold text-white">Episodes</h2>
                  {seasons.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {seasons.map((season) => (
                        <button
                          key={season.id}
                          onClick={() => setSelectedSeason(season.season_number)}
                          className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition ${
                            selectedSeason === season.season_number
                              ? 'bg-nebula-500/20 text-nebula-200 border-nebula-500/40'
                              : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {season.name || `Season ${season.season_number}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {loadingEpisodes ? (
                  <div className="glass-panel rounded-3xl p-6 text-white/70">Loading episodes...</div>
                ) : episodes.length === 0 ? (
                  <div className="glass-panel rounded-3xl p-6 text-white/70">
                    Episodes are not available yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {episodes.map((episode) => (
                      <div
                        key={episode.id}
                        className="glass-panel rounded-2xl overflow-hidden border border-white/10"
                      >
                        <div className="aspect-video bg-dark-800 overflow-hidden">
                          {episode.still_path ? (
                            <img
                              src={episode.still_path}
                              alt={episode.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">
                              No Preview
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div>
                              <p className="text-white font-medium text-sm">
                                E{episode.episode_number} · {episode.name}
                              </p>
                              {episode.runtime && (
                                <p className="text-white/50 text-xs">{episode.runtime} min</p>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                handlePlayEpisode(episode.season_number, episode.episode_number)
                              }
                              className="btn-primary text-xs px-3 py-1.5"
                            >
                              Play
                            </button>
                          </div>
                          {episode.overview && (
                            <p className="text-white/60 text-xs leading-relaxed line-clamp-3">
                              {episode.overview}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {show.cast && show.cast.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-6">Cast</h2>
                  <div className="lg:hidden overflow-x-auto pb-3 -mx-1">
                    <div className="grid grid-rows-2 auto-cols-[140px] grid-flow-col gap-3 px-1">
                      {show.cast.slice(0, 12).map((actor) => renderCastCard(actor))}
                    </div>
                  </div>

                  <div className="hidden lg:grid grid-cols-4 xl:grid-cols-5 gap-4">
                    {show.cast.slice(0, 15).map((actor) => renderCastCard(actor))}
                  </div>
                </section>
              )}

              {show.similar && show.similar.length > 0 && (
                <MovieRow title="Similar Shows" movies={show.similar} mediaType="tv" />
              )}

              {recommendations.length > 0 && (
                <MovieRow title="Recommended For You" movies={recommendations} mediaType="tv" />
              )}
            </div>

            <div className="space-y-6">
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Details</h3>
                <div className="space-y-3 text-sm text-white/70">
                  <div className="flex justify-between">
                    <span>Original Title</span>
                    <span className="text-white">{show.original_title || show.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Language</span>
                    <span className="text-white uppercase">{show.original_language}</span>
                  </div>
                  {show.status && (
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="text-white">{show.status}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Popularity</span>
                    <span className="text-white">{show.popularity.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vote Count</span>
                    <span className="text-white">{show.vote_count.toLocaleString()}</span>
                  </div>
                  {show.number_of_episodes && (
                    <div className="flex justify-between">
                      <span>Episodes</span>
                      <span className="text-white">{show.number_of_episodes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TVDetail;
