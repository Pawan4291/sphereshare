import { motion } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { SPHERE_WALLET_URL } from '../lib/sphere';

interface Props {
  onClose: () => void;
}

export default function WalletConnect({ onClose }: Props) {
  const { connect, connecting, error } = useWallet();

  const handleConnect = async () => {
    await connect(false);
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-md rounded-3xl border border-orange-500/30 overflow-hidden"
        style={{ background: 'rgba(15,8,0,0.95)' }}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Gradient top border */}
        <div className="h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

        <div className="p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <motion.div
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-2xl shadow-orange-500/30"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="text-4xl">⬡</span>
            </motion.div>
          </div>

          <h2 className="text-2xl font-black text-white text-center mb-2">Connect Sphere Wallet</h2>
          <p className="text-gray-400 text-center text-sm mb-6 leading-relaxed">
            SphereShare connects to your Sphere wallet on{' '}
            <span className="text-orange-400 font-semibold">Unicity testnet2</span> to send
            payments, split bills, and manage payouts.
          </p>

          {/* Steps */}
          <div className="space-y-3 mb-6">
            {[
              { step: '1', text: 'Open your Sphere wallet' },
              { step: '2', text: 'Approve the SphereShare connection' },
              { step: '3', text: 'Start splitting & paying!' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-orange-400">{item.step}</span>
                </div>
                <span className="text-sm text-gray-300">{item.text}</span>
              </div>
            ))}
          </div>

          {error && (
            <motion.div
              className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          <motion.button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-4 rounded-2xl font-bold text-black bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {connecting ? (
              <div className="flex items-center justify-center gap-2">
                <motion.div
                  className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
                Connecting...
              </div>
            ) : (
              'Connect to Sphere Wallet'
            )}
          </motion.button>

          <div className="mt-4 text-center">
            <a
              href={SPHERE_WALLET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-orange-400 transition-colors"
            >
              Don't have a Sphere wallet? Get one →
            </a>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
