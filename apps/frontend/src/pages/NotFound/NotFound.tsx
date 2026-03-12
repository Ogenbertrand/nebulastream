import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Film, Home, Search } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Page Not Found - NebulaStream</title>
      </Helmet>

      <div className="min-h-screen bg-dark-950 relative overflow-hidden flex items-center justify-center px-4">
        <div className="absolute inset-0">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-nebula-500/20 blur-[140px]" />
          <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-accent-500/20 blur-[140px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_45%)]" />
        </div>

        <div className="relative z-10 text-center max-w-xl">
          <div className="mb-10">
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
              <Film className="w-10 h-10 text-nebula-500" />
            </div>
            <h1 className="text-6xl font-display font-bold text-white mb-3">404</h1>
            <h2 className="text-2xl font-semibold text-white mb-3">Lost in the Nebula</h2>
            <p className="text-white/60">
              The page you're looking for doesn't exist or has drifted into deep space.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/" className="btn-primary">
              <Home className="w-5 h-5 mr-2" />
              Go Home
            </Link>
            <Link to="/search" className="btn-secondary">
              <Search className="w-5 h-5 mr-2" />
              Search Movies
            </Link>
          </div>

          <div className="mt-12">
            <p className="text-white/40 mb-4">Popular destinations:</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/browse" className="text-nebula-400 hover:text-nebula-300">
                Browse
              </Link>
              <span className="text-white/20">•</span>
              <Link to="/watchlist" className="text-nebula-400 hover:text-nebula-300">
                My List
              </Link>
              <span className="text-white/20">•</span>
              <Link to="/profile" className="text-nebula-400 hover:text-nebula-300">
                Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;
