import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Layout from './components/Layout/Layout';
import Loading from './components/Loading/Loading';
import { useAuthStore } from './store/authStore';

const Home = React.lazy(() => import('./pages/Home/Home'));
const Browse = React.lazy(() => import('./pages/Browse/Browse'));
const FilterPage = React.lazy(() => import('./pages/Filter/Filter'));
const Search = React.lazy(() => import('./pages/Search/Search'));
const MovieDetail = React.lazy(() => import('./pages/MovieDetail/MovieDetail'));
const TVDetail = React.lazy(() => import('./pages/TVDetail/TVDetail'));
const Player = React.lazy(() => import('./pages/Player/Player'));
const Login = React.lazy(() => import('./pages/Auth/Login'));
const Register = React.lazy(() => import('./pages/Auth/Register'));
const Profile = React.lazy(() => import('./pages/Profile/Profile'));
const Watchlist = React.lazy(() => import('./pages/Watchlist/Watchlist'));
const NotFound = React.lazy(() => import('./pages/NotFound/NotFound'));

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      <Helmet>
        <title>NebulaStream - Watch Movies Online</title>
        <meta
          name="description"
          content="Stream your favorite movies and TV shows on NebulaStream"
        />
      </Helmet>

      <Suspense fallback={<Loading fullScreen message="Loading experience..." />}>
        <Routes>
          {/* Auth routes (no layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Main routes with layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="browse" element={<Browse />} />
            <Route path="filter" element={<FilterPage />} />
            <Route path="search" element={<Search />} />
            <Route path="movie/:id" element={<MovieDetail />} />
            <Route path="tv/:id" element={<TVDetail />} />
            <Route path="watch/:id" element={<Player />} />
            <Route path="watch/tv/:id" element={<Player />} />
            <Route path="profile" element={isAuthenticated ? <Profile /> : <Login />} />
            <Route path="watchlist" element={isAuthenticated ? <Watchlist /> : <Login />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
