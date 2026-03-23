import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  X,
  User,
  LogOut,
  Heart,
  Film,
  Home,
  Tv2,
  Flame,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import Wordmark from '../Brand/Wordmark';

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/browse', label: 'Movies' },
    { to: '/browse?type=tv', label: 'TV Shows' },
    { to: '/browse?type=trending', label: 'Trending' },
    { to: '/watchlist', label: 'My List' },
  ];

  const isNavActive = (to: string) => {
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-dark-950/90 backdrop-blur-2xl border-b border-white/5 shadow-xl'
          : 'bg-gradient-to-b from-dark-950/60 via-dark-950/20 to-transparent'
      }`}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10">
        <div className="flex items-center justify-between py-3 sm:py-4">
          {/* Brand */}
          <Link to="/" className="flex items-center">
            <Wordmark size="lg" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8 2xl:gap-10">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${isNavActive(link.to) ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center">
              {isSearchOpen ? (
                <motion.form
                  onSubmit={handleSearch}
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 220 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden lg:w-[260px] 2xl:w-[320px]"
                >
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search titles"
                    className="w-full pl-10 pr-10 py-2.5 rounded-full bg-dark-900/80 border border-white/10 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-nebula-500"
                    autoFocus
                  />
                  <Search className="w-4 h-4 text-white/50 absolute left-3 top-2.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="absolute right-3 top-2.5 text-white/60 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.form>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition"
                >
                  <Search className="w-5 h-5 text-white/80" />
                </button>
              )}
            </div>

            <button className="hidden sm:flex p-2 rounded-full bg-white/5 hover:bg-white/10 transition relative">
              <Bell className="w-5 h-5 text-white/80" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-nebula-500" />
            </button>

            {isAuthenticated ? (
              <div className="relative group hidden md:block">
                <button className="flex items-center gap-2 p-2 rounded-full bg-white/5 hover:bg-white/10 transition">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name || user.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-nebula-500/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 text-white/70" />
                </button>

                <div className="absolute right-0 mt-3 w-52 glass-panel rounded-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="py-2">
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-white/80 hover:text-white hover:bg-white/5"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <Link
                      to="/watchlist"
                      className="flex items-center gap-2 px-4 py-2 text-white/80 hover:text-white hover:bg-white/5"
                    >
                      <Heart className="w-4 h-4" />
                      My List
                    </Link>
                    <div className="h-px bg-white/5 my-2" />
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Link to="/login" className="btn-primary text-sm hidden md:inline-flex">
                Sign In
              </Link>
            )}

            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-full bg-white/5 hover:bg-white/10"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile search bar (hidden on watchlist/profile) */}
      {!(
        location.pathname.startsWith('/watchlist') || location.pathname.startsWith('/profile')
      ) && (
        <div className="px-4 pb-3 md:hidden">
          <form onSubmit={handleSearch} className="relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies & TV shows"
              className="w-full pl-10 pr-10 py-2.5 rounded-full bg-dark-900/90 border border-white/10 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-nebula-500"
            />
            <Search className="w-4 h-4 text-white/50 absolute left-3 top-2.5" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      )}

      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 lg:hidden"
        >
          {/* Backdrop */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="relative h-full w-[82%] max-w-xs bg-dark-950 border-r border-white/10 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-2xl bg-nebula-500/20 border border-nebula-500/40 flex items-center justify-center">
                  <Film className="w-4 h-4 text-nebula-500" />
                </div>
                <div className="leading-tight text-left">
                  <span className="text-white font-display text-base tracking-wide">
                    NebulaStream
                  </span>
                  <span className="block text-[9px] uppercase tracking-[0.35em] text-white/50">
                    CINEMA
                  </span>
                </div>
              </Link>

              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search bar inside sidebar */}
            <div className="px-4 pt-3 pb-2 border-b border-white/5">
              <form onSubmit={handleSearch} className="relative">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies & TV shows"
                  className="w-full pl-10 pr-10 py-2.5 rounded-full bg-dark-900/90 border border-white/10 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-nebula-500"
                />
                <Search className="w-4 h-4 text-white/50 absolute left-3 top-2.5" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-white/60 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              <nav className="space-y-1">
                {navLinks.map((link) => {
                  const Icon =
                    link.label === 'Home'
                      ? Home
                      : link.label === 'Movies'
                        ? Film
                        : link.label === 'TV Shows'
                          ? Tv2
                          : link.label === 'Trending'
                            ? Flame
                            : Heart;

                  const isActive = isNavActive(link.to);

                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                        isActive
                          ? 'bg-nebula-500/15 text-nebula-100'
                          : 'text-white/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                          isActive
                            ? 'border-nebula-500/60 bg-nebula-500/10 text-nebula-200'
                            : 'border-white/10 bg-white/5 text-white/70'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </motion.div>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;
