import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import CreateSplitForm from '../components/CreateSplitForm';
import WalletConnect from '../components/WalletConnect';
import PublicFeed from '../components/PublicFeed';
import type { AppMode } from '../types';

const MODE_INFO = {
  split: {
    title: 'Split a Bill',
    description: 'Friends owe you money? Create a split and share the link.',
    emoji: '🍕',
    color: 'from-orange-400 to-orange-600',
  },
  payout: {
    title: 'Bulk Payout',
    description: 'Paying many people? Send to all recipients at once.',
    emoji: '💸',
    color: 'from-orange-500 to-amber-500',
  },
};

export default function HomePage() {
  const { connected } = useWallet();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AppMode>('split');
  const [showWallet, setShowWallet] = useState(false);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-black text-white mb-2">
            Create a{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
              Payment
            </span>
          </h1>
          <p className="text-gray-400">Split bills with friends or send payouts to many people at once.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            {/* Mode Toggle */}
            <motion.div
              className="mb-6 p-1.5 rounded-2xl bg-white/5 border border-orange-500/10 flex gap-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {(Object.keys(MODE_INFO) as AppMode[]).map((m) => (
                <motion.button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                    mode === m
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-black shadow-lg shadow-orange-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>{MODE_INFO[m].emoji}</span>
                  <span>{MODE_INFO[m].title}</span>
                </motion.button>
              ))}
            </motion.div>

            {/* Mode description */}
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                className="mb-6 p-4 rounded-xl border border-orange-500/15 bg-orange-500/5"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{MODE_INFO[mode].emoji}</span>
                  <div>
                    <div className="text-sm font-bold text-orange-300">{MODE_INFO[mode].title}</div>
                    <div className="text-xs text-gray-500">{MODE_INFO[mode].description}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Form / Connect Wall */}
            <motion.div
              className="p-6 rounded-2xl border border-orange-500/20"
              style={{ background: 'rgba(15,8,0,0.6)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {!connected ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔐</div>
                  <h3 className="text-xl font-bold text-white mb-3">Connect Your Wallet</h3>
                  <p className="text-gray-400 mb-6 text-sm max-w-sm mx-auto">
                    Connect your Sphere wallet to create splits and send payouts on Unicity testnet2.
                  </p>
                  <motion.button
                    onClick={() => setShowWallet(true)}
                    className="px-8 py-3 rounded-2xl font-black text-black bg-gradient-to-r from-orange-400 to-orange-600 shadow-lg shadow-orange-500/30"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    ⚡ Connect Sphere Wallet
                  </motion.button>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CreateSplitForm mode={mode} />
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Links */}
            <motion.div
              className="p-5 rounded-2xl border border-orange-500/20"
              style={{ background: 'rgba(15,8,0,0.6)' }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Quick Access</h3>
              <div className="space-y-2">
                {[
                  { icon: '📋', label: 'My Splits & Payouts', path: '/splits' },
                  { icon: '📨', label: 'Payment Requests', path: '/requests' },
                  { icon: '🏆', label: 'Leaderboard', path: '/leaderboard' },
                ].map((link) => (
                  <motion.button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all text-left"
                    whileHover={{ x: 4 }}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                    <span className="ml-auto text-gray-600">→</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>

        

            {/* Public Feed */}
            <PublicFeed />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showWallet && <WalletConnect onClose={() => setShowWallet(false)} />}
      </AnimatePresence>
    </div>
  );
}
