import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { User, Calendar, Film, Heart, Clock, Edit2, Save, X, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { userApi, watchHistoryApi, searchApi } from '../../services/api';
import { ContinueWatching, Genre, MovieListItem, UserProfile, WatchHistory } from '../../types';
import Loading from '../../components/Loading/Loading';
import toast from 'react-hot-toast';
import MovieRow from '../../components/MovieRow/MovieRow';
import { useAuthStore } from '../../store/authStore';

const StatCard: React.FC<{
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  toneClassName: string;
}> = ({ icon, value, label, toneClassName }) => {
  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${toneClassName}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-white leading-none">{value}</p>
          <p className="text-white/60 mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
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
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl glass-panel mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-nebula-500/20 via-transparent to-accent-500/15" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name || profile.username}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-white/15"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-nebula-500/15 flex items-center justify-center border border-white/10">
                      <User className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-display font-bold text-white line-clamp-2">
                        {profile.display_name || profile.username}
                      </h1>
                      <p className="text-white/60 text-sm line-clamp-1">{profile.email}</p>
                    </div>

                    {!editing && (
                      <button
                        onClick={() => setEditing(true)}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white shrink-0"
                        aria-label="Edit profile"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[12px] text-white/60">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {editing && (
                <div className="mt-6 rounded-2xl bg-black/20 border border-white/10 p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        className="input-field"
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
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
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
              )}

              {!editing && (
                <div className="mt-5">
                  <button
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: compact stats grid */}
          <div className="sm:hidden grid grid-cols-2 gap-4 mb-8">
            <StatCard
              icon={<Film className="w-6 h-6 text-nebula-500" />}
              value={profile.watch_count}
              label="Movies Watched"
              toneClassName="bg-nebula-500/15"
            />
            <StatCard
              icon={<Heart className="w-6 h-6 text-accent-500" />}
              value={profile.favorite_count}
              label="My List"
              toneClassName="bg-accent-500/15"
            />
            <div className="col-span-2">
              <StatCard
                icon={<Clock className="w-6 h-6 text-white" />}
                value={`${hoursWatched}h`}
                label="Total Watch Time"
                toneClassName="bg-white/10"
              />
            </div>
          </div>

          {/* Desktop/tablet: grid stats */}
          <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            <StatCard
              icon={<Film className="w-6 h-6 text-nebula-500" />}
              value={profile.watch_count}
              label="Movies Watched"
              toneClassName="bg-nebula-500/15"
            />
            <StatCard
              icon={<Heart className="w-6 h-6 text-accent-500" />}
              value={profile.favorite_count}
              label="My List"
              toneClassName="bg-accent-500/15"
            />
            <StatCard
              icon={<Clock className="w-6 h-6 text-white" />}
              value={`${hoursWatched}h`}
              label="Total Watch Time"
              toneClassName="bg-white/10"
            />
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
