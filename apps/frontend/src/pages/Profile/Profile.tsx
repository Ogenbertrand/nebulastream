import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { User, Mail, Calendar, Film, Heart, Clock, Edit2, Save, X } from 'lucide-react';
import { userApi, watchHistoryApi, searchApi } from '../../services/api';
import { ContinueWatching, Genre, MovieListItem, UserProfile, WatchHistory } from '../../types';
import Loading from '../../components/Loading/Loading';
import toast from 'react-hot-toast';
import MovieRow from '../../components/MovieRow/MovieRow';

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ display_name: '', avatar_url: '' });
  const [continueWatching, setContinueWatching] = useState<ContinueWatching[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistory[]>([]);
  const [favorites, setFavorites] = useState<MovieListItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);

  useEffect(() => {
    fetchProfile();
    loadCollections();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await userApi.getProfile();
      setProfile(data);
      setEditData({
        display_name: data.display_name || '',
        avatar_url: data.avatar_url || '',
      });
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      const [historyData, continueData, favoritesData, genreData] = await Promise.all([
        watchHistoryApi.getHistory(1, 20),
        watchHistoryApi.getContinueWatching(12),
        userApi.getFavorites(),
        searchApi.getGenres(),
      ]);
      setWatchHistory(historyData);
      setContinueWatching(continueData);
      setFavorites(favoritesData.favorites || []);
      setGenres(genreData);
    } catch (error) {
      console.error('Failed to load profile collections', error);
    }
  };

  const handleSave = async () => {
    try {
      await userApi.updateProfile({
        display_name: editData.display_name,
        avatar_url: editData.avatar_url,
      });
      toast.success('Profile updated');
      setEditing(false);
      fetchProfile();
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const genreMap = useMemo(() => {
    const safeGenres = Array.isArray(genres) ? genres : [];
    return safeGenres.reduce(
      (acc, genre) => {
        acc[genre.id] = genre.name;
        return acc;
      },
      {} as Record<number, string>
    );
  }, [genres]);

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <p className="text-gray-400">Failed to load profile</p>
      </div>
    );
  }

  const hoursWatched = Math.round((profile.total_watch_time || 0) / 60);

  return (
    <>
      <Helmet>
        <title>Profile - NebulaStream</title>
      </Helmet>

      <div className="min-h-screen bg-dark-950 pt-6 sm:pt-8 pb-16">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 md:p-12 glass-panel mb-10">
            <div className="absolute inset-0 bg-gradient-to-r from-nebula-500/15 via-transparent to-accent-500/10" />
            <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center">
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || profile.username}
                    className="w-20 h-20 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-white/20"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-nebula-500/20 flex items-center justify-center border border-white/10">
                    <User className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                {editing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={editData.display_name}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, display_name: e.target.value }))
                        }
                        className="input-field max-w-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-1">
                        Avatar URL
                      </label>
                      <input
                        type="url"
                        value={editData.avatar_url}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, avatar_url: e.target.value }))
                        }
                        className="input-field max-w-md"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSave} className="btn-primary">
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditData({
                            display_name: profile.display_name || '',
                            avatar_url: profile.avatar_url || '',
                          });
                        }}
                        className="btn-secondary"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-2">
                      <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
                        {profile.display_name || profile.username}
                      </h1>
                      <button
                        onClick={() => setEditing(true)}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-white/60">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {profile.username}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {profile.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Joined {new Date(profile.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-nebula-500/20 rounded-xl flex items-center justify-center">
                  <Film className="w-6 h-6 text-nebula-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{profile.watch_count}</p>
                  <p className="text-white/60">Movies Watched</p>
                </div>
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent-500/20 rounded-xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-accent-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{profile.favorite_count}</p>
                  <p className="text-white/60">My List</p>
                </div>
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{hoursWatched}h</p>
                  <p className="text-white/60">Total Watch Time</p>
                </div>
              </div>
            </div>
          </div>

          {continueWatching.length > 0 && (
            <MovieRow
              title="Continue Watching"
              movies={continueWatching.map((item) => item.movie)}
              genreMap={genreMap}
            />
          )}

          {favorites.length > 0 && (
            <MovieRow title="My List" movies={favorites} genreMap={genreMap} />
          )}

          {watchHistory.length > 0 && (
            <MovieRow
              title="Watch History"
              movies={watchHistory
                .filter((entry) => entry.movie)
                .map((entry) => entry.movie as MovieListItem)}
              genreMap={genreMap}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default Profile;
