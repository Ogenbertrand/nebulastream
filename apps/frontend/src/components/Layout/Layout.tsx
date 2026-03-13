import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import MobileNavBar from '../Navbar/MobileNavBar';

const Layout: React.FC = () => {
  const location = useLocation();
  const isFilterPage = location.pathname.startsWith('/filter');
  const isMovieDetailPage = location.pathname.startsWith('/movie/');
  const isPlayerPage = location.pathname.startsWith('/watch/');
  const hideNavbar = isFilterPage || isMovieDetailPage || isPlayerPage;

  return (
    <div className="min-h-screen bg-dark-950">
      {!hideNavbar && <Navbar />}
      <main
        className={`${
          hideNavbar ? 'pt-0' : 'pt-16 sm:pt-20 lg:pt-24'
        } pb-20 md:pb-0`}
      >
        <Outlet />
      </main>
      <MobileNavBar />
    </div>
  );
};

export default Layout;
