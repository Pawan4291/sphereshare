import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUPPORTED_TOKENS, type TokenInfo } from '../lib/tokens';

interface Props {
  selected: TokenInfo;
  onChange: (token: TokenInfo) => void;
  balances?: Record<string, string>; // coinId -> human-readable balance
}

export default function TokenSelector({ selected, onChange, balances }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-500/30 bg-orange-500/5 hover:border-orange-500/60 hover:bg-orange-500/10 transition-all w-full"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: selected.bgColor, color: selected.color }}
        >
          {selected.icon}
        </div>
        <div className="flex-1 text-left">
          <div className="text-white font-bold text-sm">{selected.symbol}</div>
          <div className="text-gray-500 text-xs">{selected.name}</div>
        </div>
        {balances?.[selected.coinId] && (
          <div className="text-xs text-gray-400 mr-2">
            {balances[selected.coinId]} {selected.symbol}
          </div>
        )}
        <motion.span
          className="text-gray-400 text-xs"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-orange-500/30 overflow-hidden z-50"
            style={{ background: 'rgba(15,8,0,0.98)' }}
            initial={{ opacity: 0, y: -10, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -10, scaleY: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            {SUPPORTED_TOKENS.map((token) => (
              <motion.button
                key={token.coinId}
                type="button"
                onClick={() => {
                  onChange(token);
                  setOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-3 w-full text-left transition-colors ${
                  token.coinId === selected.coinId
                    ? 'bg-orange-500/15'
                    : 'hover:bg-white/5'
                }`}
                whileHover={{ x: 4 }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: token.bgColor, color: token.color }}
                >
                  {token.icon}
                </div>
                <div className="flex-1">
                  <div className="text-white font-bold text-sm">{token.symbol}</div>
                  <div className="text-gray-500 text-xs">{token.name}</div>
                </div>
                {balances?.[token.coinId] && (
                  <div className="text-xs text-gray-400">
                    {balances[token.coinId]} {token.symbol}
                  </div>
                )}
                {token.coinId === selected.coinId && (
                  <span className="text-orange-400 text-xs">✓</span>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
