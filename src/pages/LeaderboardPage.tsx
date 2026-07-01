import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLeaderboard } from '../lib/storage';
import { SUPPORTED_TOKENS, formatTokenAmount, shortenAddress } from '../lib/tokens';
import type { LeaderboardEntry } from '../types';

const RANK_ICONS = ['🥇', '🥈', '🥉'];

function ScoreMeter({ score }: { score: number }) {
  const color = score >= 90 ? '#22c55e' : score >= 70 ? '#f97316' : score >= 50 ? '#eab308' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
          initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

export default function LeaderboardPage() {
  const [selectedCoinId, setSelectedCoinId] = useState(SUPPORTED_TOKENS[0].coinId);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await getLeaderboard(selectedCoinId);
      setEntries(data);
    };
    load();
  }, [selectedCoinId]);

  const token = SUPPORTED_TOKENS.find((t) => t.coinId === selectedCoinId) ?? SUPPORTED_TOKENS[0];

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <motion.div className="mb-8 text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-black text-white mb-2">
            🏆 <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Leaderboard</span>
          </h1>
          <p className="text-gray-400">Top payers per token — never summed across tokens.</p>
        </motion.div>

        <motion.div className="flex gap-2 p-1.5 rounded-2xl bg-white/5 border border-orange-500/10 mb-8 overflow-x-auto"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {SUPPORTED_TOKENS.map((t) => (
            <motion.button key={t.coinId} onClick={() => setSelectedCoinId(t.coinId)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex-shrink-0 ${selectedCoinId === t.coinId ? 'text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              style={selectedCoinId === t.coinId ? { background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)` } : {}}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <span>{t.icon}</span><span>{t.symbol}</span>
            </motion.button>
          ))}
        </motion.div>

        {entries.length >= 3 && (
          <motion.div className="grid grid-cols-3 gap-4 mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {[entries[1], entries[0], entries[2]].map((entry, i) => {
              const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
              const heights = ['h-28', 'h-36', 'h-24'];
              return (
                <motion.div key={entry.walletAddress} className={`${heights[i]} rounded-2xl border p-4 flex flex-col items-center justify-end text-center`}
                  style={{ borderColor: rank === 1 ? 'rgba(251,191,36,0.5)' : rank === 2 ? 'rgba(156,163,175,0.5)' : 'rgba(180,123,49,0.5)', background: rank === 1 ? 'rgba(251,191,36,0.1)' : rank === 2 ? 'rgba(156,163,175,0.1)' : 'rgba(180,123,49,0.1)' }}
                  whileHover={{ scale: 1.03 }}>
                  <div className="text-2xl mb-1">{RANK_ICONS[rank - 1]}</div>
                  <div className="text-xs font-mono text-gray-400 truncate max-w-full">{entry.walletAddress.startsWith('@') ? entry.walletAddress : shortenAddress(entry.walletAddress, 4)}</div>
                  <div className="text-sm font-bold mt-1" style={{ color: token.color }}>{formatTokenAmount(entry.totalPaid, token.decimals, 4)} {token.symbol}</div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <motion.div className="rounded-2xl border border-orange-500/20 overflow-hidden" style={{ background: 'rgba(15,8,0,0.6)' }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          {entries.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-gray-500">No activity for {token.symbol} yet.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-6 px-5 py-3 border-b border-orange-500/10 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div>Rank</div><div className="col-span-2">Wallet</div><div>Total Paid</div><div>Fastest</div><div>Reliability</div>
              </div>
              <AnimatePresence>
                {entries.map((entry, i) => (
                  <motion.div key={entry.walletAddress} className="grid grid-cols-6 px-5 py-4 border-b border-orange-500/5 last:border-0 hover:bg-white/3 transition-colors items-center"
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="font-black text-lg">{i < 3 ? RANK_ICONS[i] : <span className="text-gray-600 text-base">#{i + 1}</span>}</div>
                    <div className="col-span-2">
                      <div className="font-mono text-sm text-gray-300">{entry.walletAddress.startsWith('@') ? entry.walletAddress : shortenAddress(entry.walletAddress)}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{entry.splitsCreated} split{entry.splitsCreated !== 1 ? 's' : ''} created</div>
                    </div>
                    <div><span className="font-bold text-sm" style={{ color: token.color }}>{formatTokenAmount(entry.totalPaid, token.decimals, 4)}</span><span className="text-xs text-gray-600 ml-1">{token.symbol}</span></div>
                    <div className="text-sm text-gray-400">{entry.fastestPaySeconds !== undefined ? entry.fastestPaySeconds < 60 ? `${entry.fastestPaySeconds}s` : `${Math.floor(entry.fastestPaySeconds / 60)}m` : '—'}</div>
                    <div><ScoreMeter score={entry.reliabilityScore} /></div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}