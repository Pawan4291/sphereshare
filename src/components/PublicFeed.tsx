import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPublicFeed } from '../lib/storage';
import { formatTokenAmount } from '../lib/tokens';
import { TOKEN_BY_SYMBOL } from '../lib/tokens';
import type { PublicFeedItem } from '../types';

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function PublicFeed() {
  const [items, setItems] = useState<PublicFeedItem[]>([]);

  useEffect(() => {
    setItems(getPublicFeed().slice(0, 8));
    const interval = setInterval(() => {
      setItems(getPublicFeed().slice(0, 8));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  return (
    <motion.div
      className="p-5 rounded-2xl border border-orange-500/20"
      style={{ background: 'rgba(15,8,0,0.6)' }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
    >
      <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">🌐 Public Activity</h3>
      <div className="space-y-2">
        <AnimatePresence>
          {items.map((item) => {
            const token = TOKEN_BY_SYMBOL[item.tokenSymbol];
            return (
              <motion.div
                key={item.id}
                className="flex items-start gap-2 p-2 rounded-lg bg-white/3 hover:bg-white/5 transition-colors"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <span className="text-base flex-shrink-0 mt-0.5">{item.mode === 'split' ? '🍕' : '💸'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 leading-snug">
                    A{' '}
                    <span style={{ color: token?.color ?? '#f97316' }} className="font-semibold">
                      {item.totalAmount !== '0'
                        ? formatTokenAmount(BigInt(item.totalAmount), token?.decimals ?? 18, 4)
                        : '?'}{' '}
                      {item.tokenSymbol}
                    </span>{' '}
                    {item.mode === 'payout' ? 'payout' : 'split'} was{' '}
                    {item.mode === 'payout' ? 'sent' : 'created'}
                    {item.recipientCount > 0 && ` for ${item.recipientCount} people`}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{timeAgo(item.createdAt)}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
