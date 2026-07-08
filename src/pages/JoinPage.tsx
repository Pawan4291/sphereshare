import { useState, useEffect } from 'react';

import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatedBackground } from '../components/AnimatedBackground';
import WalletConnect from '../components/WalletConnect';
import { useWallet } from '../context/WalletContext';
import { getSplit, getSplitMembers, addMember, markMemberPaid, recordPayment, upsertLeaderboard } from '../lib/storage';
import { formatTokenAmount, TOKEN_BY_SYMBOL, TOKEN_BY_COIN_ID } from '../lib/tokens';
import { getErrorMessage, ERROR_CODES } from '../lib/sphere';
import type { Split, SplitMember } from '../types';

export default function JoinPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { connected, identity, client } = useWallet();
  const [split, setSplit] = useState<Split | null>(null);
  const [members, setMembers] = useState<SplitMember[]>([]);
  const [showWallet, setShowWallet] = useState(false);
  const [myMember, setMyMember] = useState<SplitMember | null>(null);
  const [joining, setJoining] = useState(false);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<'paid' | 'declined' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const existing = m.find((x) =>
        x.walletAddress === identity.address ||
        x.walletAddress === identity.nametag ||
        x.walletAddress === `@${identity.nametag}`
      );
      if (existing) setMyMember(existing);
    };
    check();
  }, [split, identity?.address]);

  const handleJoin = async () => {
  if (!split || !identity?.address) return;
  setJoining(true);
  setError(null);
  try {
    const currentMembers = await getSplitMembers(split.id);
    const existing = currentMembers.find((m) =>
      m.walletAddress === identity.address ||
      m.walletAddress === identity.nametag ||
      m.walletAddress === `@${identity.nametag}`
    );
    if (existing) {
      setMyMember(existing);
    } else {
      setError('This split is not for you.');
    }
  } catch (err: any) {
    const code = (err as { code?: number })?.code;
    setError(code ? getErrorMessage(code) : err?.message ?? 'Failed to join.');
  } finally {
    setJoining(false);
  }
};

  const handlePay = async () => {
    if (!client || !myMember || !split) return;
    setPaying(true);
    setError(null);
    try {
      await client.intent('send', {
        to: split.creatorWallet,
        amount: myMember.amountOwed.toString(),
        coinId: split.coinId,
      });
      await markMemberPaid(myMember.id);
      await recordPayment({
  splitId: split.id,
  fromWallet: identity?.address ?? '',
  toWallet: split.creatorWallet,
  coinId: split.coinId,
  amount: myMember.amountOwed,
});
await upsertLeaderboard(identity?.nametag ?? identity?.address ?? '', split.coinId, {
  totalPaid: myMember.amountOwed,
  timesSettled: 1,
});
setDone('paid');
setTimeout(() => navigate('/requests'), 1500);
    } catch (err: any) {
      const code = (err as { code?: number })?.code;
      if (code !== ERROR_CODES.USER_REJECTED && code !== ERROR_CODES.INTENT_CANCELLED) {
        setError(code ? getErrorMessage(code) : err?.message ?? 'Payment failed.');
      }
    } finally {
      setPaying(false);
    }
  };

  const handleDecline = async () => {
    if (!myMember) return;
    await markMemberPaid(myMember.id, 'declined');
setDone('declined');
setTimeout(() => navigate('/requests'), 1500);
  };

  if (!split) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <AnimatedBackground />
        <div className="relative z-10 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-400">Split not found or invalid link.</p>
          <button onClick={() => navigate('/')} className="mt-4 text-orange-400 hover:text-orange-300">Go home →</button>
        </div>
      </div>
    );
  }

  const token = TOKEN_BY_SYMBOL[split.tokenSymbol] ?? TOKEN_BY_COIN_ID[split.coinId];
  const totalMembers = members.length + (myMember ? 0 : 1);
 const yourShare = myMember?.amountOwed ?? (
  split.distributionType === 'equal'
    ? split.totalAmount / BigInt(Math.max(members.length, 1))
    : 0n
);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-md">

        {/* Close button */}
        <div className="flex justify-end mb-4">
          <button onClick={() => navigate('/')}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <motion.div className="text-center mb-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-5xl mb-3">🍕</div>
          <h1 className="text-3xl font-black text-white">Payment Request</h1>
          <p className="text-gray-400 mt-1 text-sm">from {split.creatorWallet.startsWith('@') ? split.creatorWallet : split.creatorWallet.slice(0, 10) + '...'}</p>
        </motion.div>

        <motion.div className="rounded-3xl border border-orange-500/30 overflow-hidden mb-6"
          style={{ background: 'rgba(15,8,0,0.95)' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
          <div className="p-6">
            <h2 className="text-xl font-black text-white mb-2">{split.title}</h2>

            {/* Amount */}
            <div className="text-center py-6">
              <div className="text-5xl font-black text-orange-400">
                {formatTokenAmount(yourShare, token?.decimals ?? 18)}
              </div>
              <div className="text-gray-400 text-lg mt-1">{split.tokenSymbol}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Total Split</div>
                <div className="font-bold text-white text-sm">{formatTokenAmount(split.totalAmount, token?.decimals ?? 18)} {split.tokenSymbol}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Members</div>
                <div className="font-bold text-white">{members.length}</div>
              </div>
            </div>

            {split.status !== 'open' && (
              <div className="mb-4 p-3 rounded-xl bg-gray-500/10 border border-gray-500/20 text-gray-400 text-sm text-center">
                This split is {split.status}.
              </div>
            )}

            {error && (
              <motion.div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {error}
              </motion.div>
            )}

            {/* Done state */}
            {done === 'paid' && (
              <div className="text-center py-4">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-green-400 font-bold">Payment sent!</p>
                <button onClick={() => navigate('/')} className="mt-4 text-orange-400 hover:text-orange-300 text-sm">← Back to home</button>
              </div>
            )}

            {done === 'declined' && (
              <div className="text-center py-4">
                <div className="text-4xl mb-2">❌</div>
                <p className="text-red-400 font-bold">Request declined.</p>
                <button onClick={() => navigate('/')} className="mt-4 text-orange-400 hover:text-orange-300 text-sm">← Back to home</button>
              </div>
            )}

            {/* Not connected */}
            {!done && !connected && (
              <motion.button onClick={() => setShowWallet(true)}
                className="w-full py-4 rounded-2xl font-black text-black bg-gradient-to-r from-orange-400 to-orange-600 shadow-lg shadow-orange-500/30"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                ⚡ Connect Wallet to Pay
              </motion.button>
            )}

            {/* Connected but not joined yet */}
            {!done && connected && !myMember && split.status === 'open' && (
              <motion.button onClick={handleJoin} disabled={joining}
                className="w-full py-4 rounded-2xl font-black text-black bg-gradient-to-r from-orange-400 to-orange-600 disabled:opacity-50 shadow-lg shadow-orange-500/30"
                whileHover={{ scale: joining ? 1 : 1.02 }} whileTap={{ scale: joining ? 1 : 0.98 }}>
                {joining ? 'Loading...' : '🍕 View Payment Request'}
              </motion.button>
            )}

            {/* Joined — show Pay / Decline */}
            {!done && connected && myMember && !myMember.paid && !myMember.invalidAddress && split.status === 'open' && (
              <div className="flex gap-3">
                <motion.button onClick={handleDecline}
                  className="flex-1 py-4 rounded-2xl font-black text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  ✕ Decline
                </motion.button>
                <motion.button onClick={handlePay} disabled={paying}
                  className="flex-2 flex-1 py-4 rounded-2xl font-black text-black bg-gradient-to-r from-orange-400 to-orange-600 disabled:opacity-50 shadow-lg shadow-orange-500/30"
                  whileHover={{ scale: paying ? 1 : 1.02 }} whileTap={{ scale: paying ? 1 : 0.98 }}>
                  {paying ? 'Paying...' : `Pay ${formatTokenAmount(myMember.amountOwed, token?.decimals ?? 18)} ${split.tokenSymbol}`}
                </motion.button>
              </div>
            )}

            {/* Already paid/declined */}
            {!done && myMember?.paid && (
              <div className="text-center py-4">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-green-400 font-bold">Already paid!</p>
              </div>
            )}
            {!done && myMember?.invalidAddress && (
              <div className="text-center py-4">
                <div className="text-4xl mb-2">❌</div>
                <p className="text-red-400 font-bold">Already declined.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      {showWallet && <WalletConnect onClose={() => setShowWallet(false)} />}
    </div>
  );
}