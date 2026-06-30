import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import SplitsPage from './pages/SplitsPage';
import RequestsPage from './pages/RequestsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import JoinPage from './pages/JoinPage';

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
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
