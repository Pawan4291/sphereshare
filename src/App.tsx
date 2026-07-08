import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import SplitsPage from './pages/SplitsPage';
import RequestsPage from './pages/RequestsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import JoinPage from './pages/JoinPage';

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const LAST_ROUTE_KEY = 'sphereshare-last-route';

function RouteMemory() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = sessionStorage.getItem(LAST_ROUTE_KEY);
    if (location.pathname === '/' && saved && saved !== '/') {
      navigate(saved, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (location.pathname.startsWith('/join/')) return;
    sessionStorage.setItem(LAST_ROUTE_KEY, location.pathname);
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <RouteMemory />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<Layout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/splits" element={<SplitsPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Route>
          <Route path="/join/:id" element={<JoinPage />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  );
}
