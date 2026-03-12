import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-dark-950">
      <Navbar />
      <main className="pt-20">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
