import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { shortenAddress } from '../lib/tokens';
import WalletConnect from './WalletConnect';

const NAV_ITEMS = [
  { to: '/home', label: 'Create' },
  { to: '/splits', label: 'My Splits' },
  { to: '/requests', label: 'Requests' },
  { to: '/leaderboard', label: 'Leaderboard' },
];

export default function Navbar() {
  const { connected, identity, disconnect } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div
          className="mx-4 mt-3 rounded-2xl border border-orange-500/20"
          style={{
            background: 'rgba(10,5,0,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex items-center justify-between px-5 py-3">
            {/* Logo */}
            <motion.button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 group"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <img src="/logo.png" alt="SphereShare" className="w-8 h-8 rounded-lg" />
              <span className="font-black text-white text-lg tracking-tight">
                Sphere<span className="text-orange-500">Share</span>
              </span>
            </motion.button>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'text-orange-400 bg-orange-500/15 border border-orange-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Wallet */}
            <div className="flex items-center gap-3">
              {connected && identity ? (
                <motion.div className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-orange-300 font-medium">
                      {identity.nametag ? `@${identity.nametag}` : shortenAddress(identity.address)}
                    </span>
                  </div>
                  <motion.button
                    onClick={disconnect}
                    className="px-3 py-1.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Disconnect
                  </motion.button>
                </motion.div>
              ) : (
                <motion.button
                  onClick={() => setShowWallet(true)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Connect Wallet
                </motion.button>
              )}

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                <div className="w-5 flex flex-col gap-1">
                  <motion.div
                    className="h-0.5 bg-current rounded"
                    animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                  />
                  <motion.div
                    className="h-0.5 bg-current rounded"
                    animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
                  />
                  <motion.div
                    className="h-0.5 bg-current rounded"
                    animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                  />
                </div>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-orange-500/10"
              >
                <div className="px-4 py-3 flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? 'text-orange-400 bg-orange-500/15'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      <AnimatePresence>
        {showWallet && <WalletConnect onClose={() => setShowWallet(false)} />}
      </AnimatePresence>
    </>
  );
}
