import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Film, Tv2, Heart, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { userApi } from '../../services/api';

const MobileNavBar: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const [favoriteCount, setFavoriteCount] = useState<number>(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setFavoriteCount(0);
      return;
    }

    let canceled = false;
    userApi
      .getFavorites()
      .then((data) => {
        if (!canceled) {
          setFavoriteCount(Array.isArray(data?.favorites) ? data.favorites.length : 0);
        }
      })
      .catch(() => {
        if (!canceled) {
          setFavoriteCount(0);
        }
      });

    return () => {
      canceled = true;
    };
  }, [isAuthenticated, location.pathname]);

  const items = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/browse', label: 'Movies', icon: Film },
    { to: '/browse?type=tv', label: 'TV', icon: Tv2 },
    { to: '/watchlist', label: 'My List', icon: Heart },
    {
      to: isAuthenticated ? '/profile' : '/login',
      label: 'Profile',
      icon: User,
    },
  ];

  const isActive = (to: string) => {
    const [path, query = ''] = to.split('?');
    if (location.pathname !== path) return false;
    if (!query) return true;

    const current = new URLSearchParams(location.search);
    const target = new URLSearchParams(query);
    for (const [key, value] of target.entries()) {
      if (current.get(key) !== value) return false;
    }
    return true;
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-dark-950/95 backdrop-blur-xl md:hidden">
      <div className="max-w-screen-md mx-auto flex items-stretch justify-around px-2 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 rounded-xl py-1.5 text-[11px] ${
                active
                  ? 'bg-nebula-500/10 text-nebula-300'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="relative">
                <Icon className={`w-4 h-4 ${active ? 'text-nebula-400' : 'text-white/70'}`} />
                {item.to === '/watchlist' && favoriteCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-nebula-500 text-[10px] leading-4 text-white text-center">
                    {favoriteCount > 99 ? '99+' : favoriteCount}
                  </span>
                )}
              </span>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavBar;
