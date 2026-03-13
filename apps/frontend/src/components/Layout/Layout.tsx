import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-dark-950">
      <Navbar />
      <main className="pt-16 sm:pt-20 lg:pt-24">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
