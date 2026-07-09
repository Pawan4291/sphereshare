import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { AnimatedBackground } from '../components/AnimatedBackground';
import WalletConnect from '../components/WalletConnect';
import { useWallet } from '../context/WalletContext';

const ROTATING_WORDS = ['Split Bills', 'Send Payroll', 'Airdrop Tokens', 'Pay Anyone'];

const FEATURES = [
  {
    icon: '⚡',
    title: 'Lightning Fast',
    desc: 'Payments settle on Unicity testnet2 in seconds, not minutes.',
    gradient: 'from-orange-500/20 to-transparent',
  },
  {
    icon: '🤖',
    title: 'Autonomous Agent',
    desc: 'Automated agent runs every 2 minutes — sends reminders, detects payments, and settles splits.',
    gradient: 'from-orange-400/20 to-transparent',
  },
  {
    icon: '🪙',
    title: 'Multi-Token',
    desc: 'Pay with UCT, SOL, BTC, or ETH — any asset in your Sphere wallet.',
    gradient: 'from-orange-600/20 to-transparent',
  },
  {
    icon: '🔒',
    title: 'Privacy First',
    desc: 'Only you and your recipients see your splits. Public feed is anonymized.',
    gradient: 'from-orange-500/20 to-transparent',
  },
  {
    icon: '📊',
    title: 'Leaderboard',
    desc: 'Track reliability scores and fastest payment times per token.',
    gradient: 'from-orange-400/20 to-transparent',
  },
  {
    icon: '📄',
    title: 'Export Reports',
    desc: 'Download payment CSVs for accounting and auditing.',
    gradient: 'from-orange-600/20 to-transparent',
  },
];

const STATS = [
  { value: '2', label: 'Modes', sub: 'Split & Payout' },
  { value: '4', label: 'Tokens', sub: 'UCT, SOL, BTC, ETH' },
  { value: '2m', label: 'Agent Loop', sub: 'Automated' },
  { value: '∞', label: 'Recipients', sub: 'Via CSV or + button' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const [showWallet, setShowWallet] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, -150]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleGetStarted = () => {
    if (connected) {
      navigate('/home');
    } else {
      setShowWallet(true);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <AnimatedBackground />

      {/* Hero */}
      <motion.section
        ref={heroRef}
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 text-center"
      >
        {/* Logo */}
        <motion.div
          className="mb-8"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.2 }}
        >
          <div className="relative inline-block">
            <motion.div
              className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shadow-orange-500/40"
              animate={{
                boxShadow: [
                  '0 0 40px rgba(255,107,0,0.3)',
                  '0 0 80px rgba(255,107,0,0.6)',
                  '0 0 40px rgba(255,107,0,0.3)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img src="/logo.png" alt="SphereShare" className="w-full h-full object-cover" />
            </motion.div>
            <motion.div
              className="absolute -inset-2 rounded-3xl border-2 border-orange-500/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            />
          </div>
        </motion.div>

        {/* Badge */}
        <motion.div
          className="mb-6 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-xs text-orange-400 font-semibold tracking-wider uppercase"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          ⚡ Powered by Unicity Sphere testnet2
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-4 leading-none"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <span className="text-white">Sphere</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
            Share
          </span>
        </motion.h1>

        <motion.div
          className="h-16 md:h-20 mb-4 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={wordIndex}
              className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-orange-500"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {ROTATING_WORDS[wordIndex]}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        <motion.p
          className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          Split bills with friends or send bulk payouts to hundreds with any token, zero manual
          work. The autonomous agent handles reminders, detection, and settlement{' '}
          <span className="text-orange-400 font-semibold">autonomously</span>.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <motion.button
            onClick={handleGetStarted}
            className="px-10 py-4 rounded-2xl font-black text-lg text-black bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 shadow-2xl shadow-orange-500/40 relative overflow-hidden group"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 0.5 }}
            />
            {connected ? '🚀 Open App' : '⚡ Get Started Free'}
          </motion.button>

          <motion.button
            onClick={() => navigate('/leaderboard')}
            className="px-10 py-4 rounded-2xl font-bold text-lg text-white border border-orange-500/40 hover:border-orange-500/80 hover:bg-orange-500/10 transition-all"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            📊 View Leaderboard
          </motion.button>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 text-center"
              whileHover={{ scale: 1.05, borderColor: 'rgba(249,115,22,0.4)' }}
              transition={{ delay: 1 + i * 0.1 }}
            >
              <div className="text-3xl font-black text-orange-400">{stat.value}</div>
              <div className="text-sm font-bold text-white">{stat.label}</div>
              <div className="text-xs text-gray-500">{stat.sub}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-xs">Scroll to explore</span>
          <div className="w-5 h-8 rounded-full border border-gray-700 flex items-start justify-center pt-1">
            <motion.div
              className="w-1 h-2 rounded-full bg-orange-500"
              animate={{ y: [0, 12, 0], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </motion.section>

      {/* Features */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Everything you need to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
                pay smarter
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Built on Unicity's cryptographic bearer asset protocol — payments are the proofs.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={i}
                className="relative p-6 rounded-2xl border border-orange-500/20 overflow-hidden group cursor-default"
                style={{ background: 'rgba(15,8,0,0.6)' }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02, borderColor: 'rgba(249,115,22,0.5)' }}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <div className="relative z-10">
                  <div className="text-4xl mb-4">{feat.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{feat.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              How it{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
                works
              </span>
            </h2>
          </motion.div>

          <div className="space-y-6">
            {[
              {
                num: '01',
                title: 'Connect your Sphere wallet',
                desc: 'SphereShare connects via the Sphere Connect protocol to Unicity testnet2. Your keys never leave your wallet.',
              },
              {
                num: '02',
                title: 'Create a Split or Payout',
                desc: 'Choose your token, set amounts (equal or custom), add recipients via + button or CSV upload.',
              },
              {
                num: '03',
                title: 'Share the link',
                desc: 'In Split mode, share a join link. In Payout mode, send immediately to all recipients.',
              },
              {
                num: '04',
                title: 'Agent handles the rest',
              desc: 'The autonomous agent sends reminders every 24h, detects payments, settles splits, and updates the leaderboard automatically.',
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                className="flex gap-6 p-6 rounded-2xl border border-orange-500/20 bg-orange-500/5"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ borderColor: 'rgba(249,115,22,0.4)' }}
              >
                <div className="text-4xl font-black text-orange-500/30 flex-shrink-0 w-16 text-right">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{step.title}</h3>
                  <p className="text-gray-400">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-4">
        <motion.div
          className="max-w-3xl mx-auto text-center p-12 rounded-3xl border border-orange-500/30 relative overflow-hidden"
          style={{ background: 'rgba(15,8,0,0.8)' }}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Ready to split?
            </h2>
            <p className="text-gray-400 text-lg mb-8">
              Join SphereShare on Unicity testnet2 and experience the future of group payments.
            </p>
            <motion.button
              onClick={handleGetStarted}
              className="px-12 py-4 rounded-2xl font-black text-xl text-black bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 shadow-2xl shadow-orange-500/40"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              {connected ? '🚀 Open App' : '⚡ Connect & Start'}
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-orange-500/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-gray-600 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-orange-500">⬡</span>
            <span>SphereShare — Built on Unicity Sphere testnet2</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://sphere.unicity.network"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors"
            >
              Sphere Wallet
            </a>
            <a
              href="https://developers.unicity.network"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors"
            >
              Docs
            </a>
            <a
              href="https://faucet.unicity.network/faucet/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors"
            >
              Faucet
            </a>
          </div>
        </div>
      </footer>

      <AnimatePresence>
  {showWallet && <WalletConnect onClose={() => { setShowWallet(false); navigate('/home'); }} />}
</AnimatePresence>
    </div>
  );
}
