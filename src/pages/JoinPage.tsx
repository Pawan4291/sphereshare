import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatedBackground } from '../components/AnimatedBackground';
import WalletConnect from '../components/WalletConnect';
import { useWallet } from '../context/WalletContext';
import { getSplit, getSplitMembers, addMember } from '../lib/storage';
import { formatTokenAmount, TOKEN_BY_SYMBOL, TOKEN_BY_COIN_ID } from '../lib/tokens';
import { getErrorMessage } from '../lib/sphere';
import type { Split, SplitMember } from '../types';

export default function JoinPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { connected, identity, client } = useWallet();
  const [split, setSplit] = useState<Split | null>(null);
  const [members, setMembers] = useState<SplitMember[]>([]);
  const [showWallet, setShowWallet] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const s = await getSplit(id);
      setSplit(s);
      if (s) {
        const m = await getSplitMembers(s.id);
        setMembers(m);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!split || !identity?.address) return;
    const check = async () => {
      const m = await getSplitMembers(split.id);
      setMembers(m);
      if (m.find((x) => x.walletAddress === identity.address)) setAlreadyMember(true);
    };
    check();
  }, [split, identity?.address]);

  const handleJoin = async () => {
    if (!split || !identity?.address) return;
    setJoining(true);
    setError(null);

    try {
      let valid = true;
      if (client) {
        try {
          const resolved = await client.query('sphere_resolve', { identifier: identity.address });
          valid = !!resolved;
        } catch {
          valid = true;
        }
      }

      if (!valid) {
        setError('Your wallet address could not be resolved on testnet2.');
        return;
      }

      const currentMembers = await getSplitMembers(split.id);
      const totalMembers = currentMembers.length + 1;
      let amountOwed: bigint;

      if (split.distributionType === 'equal') {
        amountOwed = split.totalAmount / BigInt(totalMembers);
      } else {
        amountOwed = 0n;
      }

      await addMember({
        splitId: split.id,
        walletAddress: identity.address,
        amountOwed,
        paid: false,
        reminderCount: 0,
        invalidAddress: false,
        retryCount: 0,
      });

      if (client && amountOwed > 0n) {
        try {
          await client.intent('payment_request', {
            to: identity.address,
            amount: amountOwed.toString(),
            coinId: split.coinId,
            message: `You joined "${split.title}". Your share is due.`,
          });
        } catch {
          // Non-fatal
        }
      }

      const updated = await getSplitMembers(split.id);
      setMembers(updated);
      setJoined(true);
    } catch (err: any) {
      const code = (err as { code?: number })?.code;
      setError(code ? getErrorMessage(code) : err?.message ?? 'Failed to join split.');
    } finally {
      setJoining(false);
    }
  };

  if (!split) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <AnimatedBackground />
        <div className="relative z-10 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-400">Split not found or invalid link.</p>
          <button onClick={() => navigate('/')} className="mt-4 text-orange-400 hover:text-orange-300">
            Go home →
          </button>
        </div>
      </div>
    );
  }

  const token = TOKEN_BY_SYMBOL[split.tokenSymbol] ?? TOKEN_BY_COIN_ID[split.coinId];
  const totalMembers = members.length + (alreadyMember ? 0 : 1);
  const yourShare = split.distributionType === 'equal'
    ? split.totalAmount / BigInt(Math.max(totalMembers, 1))
    : 0n;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-md">
        <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-5xl mb-3">🍕</div>
          <h1 className="text-3xl font-black text-white">You're invited!</h1>
          <p className="text-gray-400 mt-2">Join this split on SphereShare</p>
        </motion.div>

        <motion.div className="rounded-3xl border border-orange-500/30 overflow-hidden mb-6"
          style={{ background: 'rgba(15,8,0,0.95)' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <div className="h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
          <div className="p-6">
            <h2 className="text-2xl font-black text-white mb-4">{split.title}</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Total Amount</div>
                <div className="font-bold text-orange-400">{formatTokenAmount(split.totalAmount, token?.decimals ?? 18)} {split.tokenSymbol}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Split Type</div>
                <div className="font-bold text-white capitalize">{split.distributionType}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Members</div>
                <div className="font-bold text-white">{members.length}</div>
              </div>
              {split.distributionType === 'equal' && (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <div className="text-xs text-gray-500 mb-1">Your Share</div>
                  <div className="font-bold text-orange-400">{formatTokenAmount(yourShare, token?.decimals ?? 18)} {split.tokenSymbol}</div>
                </div>
              )}
            </div>

            {split.status !== 'open' && (
              <div className="mb-4 p-3 rounded-xl bg-gray-500/10 border border-gray-500/20 text-gray-400 text-sm text-center">
                This split is {split.status}. No new members can join.
              </div>
            )}

            {error && (
              <motion.div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {error}
              </motion.div>
            )}

            {joined || alreadyMember ? (
              <div className="text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-green-400 font-bold mb-4">{joined ? "You've joined the split!" : "You're already in this split."}</p>
                <button onClick={() => navigate('/requests')} className="px-6 py-3 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400 transition-colors">
                  View in Requests →
                </button>
              </div>
            ) : !connected ? (
              <motion.button onClick={() => setShowWallet(true)}
                className="w-full py-4 rounded-2xl font-black text-black bg-gradient-to-r from-orange-400 to-orange-600 shadow-lg shadow-orange-500/30"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                ⚡ Connect Wallet to Join
              </motion.button>
            ) : split.status !== 'open' ? null : (
              <motion.button onClick={handleJoin} disabled={joining}
                className="w-full py-4 rounded-2xl font-black text-black bg-gradient-to-r from-orange-400 to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30"
                whileHover={{ scale: joining ? 1 : 1.02 }} whileTap={{ scale: joining ? 1 : 0.98 }}>
                {joining ? (
                  <div className="flex items-center justify-center gap-2">
                    <motion.div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full"
                      animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    Joining...
                  </div>
                ) : '🍕 Join Split'}
              </motion.button>
            )}
          </div>
        </motion.div>

        <div className="text-center">
          <button onClick={() => navigate('/')} className="text-sm text-gray-600 hover:text-gray-400 transition-colors">
            ← Back to SphereShare
          </button>
        </div>
      </div>
      {showWallet && <WalletConnect onClose={() => setShowWallet(false)} />}
    </div>
  );
}