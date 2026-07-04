import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import TokenSelector from './TokenSelector';
import { SUPPORTED_TOKENS, parseTokenAmount, type TokenInfo } from '../lib/tokens';
import { createSplit, addMembers, deleteSplit } from '../lib/storage';
import { parseCSV } from '../lib/csv';
import type { RecipientRow, AppMode } from '../types';
import { getErrorMessage, ERROR_CODES } from '../lib/sphere';


interface Props {
  mode: AppMode;
}

type DistributionType = 'equal' | 'custom';

export default function CreateSplitForm({ mode }: Props) {
  const { client, identity } = useWallet();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [token, setToken] = useState<TokenInfo>(SUPPORTED_TOKENS[0]);
  const [distribution, setDistribution] = useState<DistributionType>('equal');
  const [totalAmount, setTotalAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [newWallet, setNewWallet] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [csvText, setCsvText] = useState('');
  const [showCSV, setShowCSV] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [payoutResults, setPayoutResults] = useState<{ wallet: string; paid: boolean }[]>([]);

 const fetchBalances = useCallback(async () => {
  if (!client) return;
  try {
    const bal = await client.query('sphere_getBalance');
    if (Array.isArray(bal)) {
      const map: Record<string, string> = {};
      for (const item of bal as any[]) {
        if (item.coinId && item.totalAmount !== undefined) {
          const tkn = SUPPORTED_TOKENS.find(t => t.coinId === item.coinId);
          if (tkn) {
           const divisor = BigInt(10 ** tkn.decimals);
const total = BigInt(item.totalAmount);
const intPart = total / divisor;
const fracPart = total % divisor;
const human = `${intPart}.${fracPart.toString().padStart(tkn.decimals, '0').slice(0, 6)}`;
            map[item.coinId] = human;
          }
        }
      }
      setBalances(map);
    }
  } catch(e) { console.error('Balance error:', e); }
}, [client]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const validateAddress = useCallback(async (addr: string): Promise<boolean> => {
    if (!client) return true;
    try {
      const res = await client.query('sphere_resolve', { identifier: addr });
      return !!res;
    } catch {
      return false;
    }
  }, [client]);

  const addRecipient = async () => {
    if (!newWallet.trim()) return;
    const row: RecipientRow = {
      wallet: newWallet.trim(),
      amount: newAmount.trim() || undefined,
      status: 'checking',
    };
    setRecipients((prev) => [...prev, row]);
    setNewWallet('');
    setNewAmount('');
    const valid = await validateAddress(row.wallet);
    setRecipients((prev) =>
      prev.map((r) =>
        r.wallet === row.wallet && r.status === 'checking'
          ? { ...r, status: valid ? 'valid' : 'invalid', errorMsg: valid ? undefined : 'Address could not be resolved on testnet2' }
          : r
      )
    );
  };

  const removeRecipient = (idx: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCSVImport = async () => {
    if (!csvText.trim()) return;
    const rows = parseCSV(csvText, distribution === 'custom');
    const newRows: RecipientRow[] = rows.map((r) => ({
      wallet: r.wallet,
      amount: r.amount,
      status: 'pending' as const,
    }));
    setRecipients((prev) => [...prev, ...newRows]);
    setCsvText('');
    setShowCSV(false);
    for (const row of newRows) {
      const valid = await validateAddress(row.wallet);
      setRecipients((prev) =>
        prev.map((r) =>
          r.wallet === row.wallet && r.status === 'pending'
            ? { ...r, status: valid ? 'valid' : 'invalid', errorMsg: valid ? undefined : 'Cannot resolve address' }
            : r
        )
      );
    }
  };

  const perPersonAmount = (): string => {
    if (!totalAmount || recipients.length === 0) return '0';
    const total = parseFloat(totalAmount);
    const valid = recipients.filter((r) => r.status !== 'invalid');
    if (valid.length === 0) return '0';
    return (total / valid.length).toFixed(6);
  };

  const totalCustomAmount = (): string => {
    return recipients
      .filter((r) => r.status !== 'invalid' && r.amount)
      .reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0)
      .toFixed(6);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity?.address) {
      setError('Please connect your wallet first.');
      return;
    }
    const validRecipients = recipients.filter((r) => r.status === 'valid');
    if (validRecipients.length === 0) {
      setError('Please add at least one valid recipient.');
      return;
    }
    const totalHuman = distribution === 'equal' ? totalAmount : totalCustomAmount();
    if (!totalHuman || parseFloat(totalHuman) <= 0) {
      setError('Please enter a valid total amount.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const totalBase = parseTokenAmount(totalHuman, token.decimals);

      const split = await createSplit({
        mode,
        title: title || (mode === 'split' ? 'Group Split' : 'Bulk Payout'),
        coinId: token.coinId,
        tokenSymbol: token.symbol,
        totalAmount: totalBase,
        distributionType: distribution,
        creatorWallet: identity.address,
        deadline: deadline || undefined,
        status: 'open',
        requireApproval,
      });

      const memberData = validRecipients.map((r) => {
        let amount: bigint;
        if (distribution === 'equal') {
          amount = totalBase / BigInt(validRecipients.length);
        } else {
          amount = parseTokenAmount(r.amount || '0', token.decimals);
        }
        return {
          splitId: split.id,
          walletAddress: r.wallet,
          amountOwed: amount,
          paid: false,
          reminderCount: 0,
          invalidAddress: false,
          retryCount: 0,
        };
      });
      await addMembers(memberData);

   const payoutResults: { wallet: string; paid: boolean }[] = [];
if (mode === 'payout' && client && !requireApproval) {
  const { markMemberPaid } = await import('../lib/storage');
  for (const member of memberData) {
    try {
      await client.intent('send', {
        to: member.walletAddress,
        amount: member.amountOwed.toString(),
        coinId: token.coinId,
      });
      const { getSplitMembers } = await import('../lib/storage');
const members = await getSplitMembers(split.id);
const m = members.find(x => x.walletAddress === member.walletAddress);
if (m) await markMemberPaid(m.id);
setPayoutResults(prev => [...prev, { wallet: member.walletAddress, paid: true }]);
    } catch (payErr: any) {
      const code = (payErr as { code?: number })?.code;
      if (code === ERROR_CODES.USER_REJECTED || code === ERROR_CODES.INTENT_CANCELLED) {
  setPayoutResults(prev => [...prev, { wallet: member.walletAddress, paid: false }]);
  break;
}
setPayoutResults(prev => [...prev, { wallet: member.walletAddress, paid: false }]);
    }
  }
}

   let cancelled = false;
if (mode === 'split' && client) {
  for (const member of memberData) {
    try {
      await client.intent('payment_request', {
              to: member.walletAddress,
              amount: member.amountOwed.toString(),
              coinId: token.coinId,
              message: `Your share of "${title || 'Group Split'}" — ${(Number(member.amountOwed) / 10 ** token.decimals).toFixed(6)} ${token.symbol}`,
            });
          } catch (e: any) {
  if (e?.code === ERROR_CODES.USER_REJECTED || e?.code === ERROR_CODES.INTENT_CANCELLED) { cancelled = true; break; }
}
        }
      }

     if (!cancelled) {
  setCreatedId(split.id);
} else {
  await deleteSplit(split.id);
  setCreatedId(null);
  setError('Split cancelled — no requests were sent.');
}
    } catch (err: any) {
      const code = (err as { code?: number })?.code;
      setError(code ? getErrorMessage(code) : err?.message ?? 'Failed to create. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdId) {
    const shareUrl = `${window.location.origin}/join/${createdId}`;
    return (
      <motion.div
        className="p-8 rounded-2xl border border-green-500/30 bg-green-500/5 text-center"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className="text-5xl mb-4">🎉</div>

        {payoutResults.length > 0 && (
  <div className="mb-4 text-left space-y-1">
    {payoutResults.map((r, i) => (
      <div key={i} className={`text-xs px-3 py-2 rounded-lg ${r.paid ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
        {r.paid ? '✓' : '✗'} {r.wallet} — {r.paid ? `${token.symbol} sent` : 'not paid'}
      </div>
    ))}
  </div>
)}
        
        <h3 className="text-2xl font-black text-white mb-2">
          {mode === 'split' ? 'Split Created!' : 'Payout Sent!'}
        </h3>
        <p className="text-gray-400 mb-6">
          {mode === 'split'
            ? 'Share the link below with your group. The Astrid agent will track payments automatically.'
            : 'Payments have been dispatched. The Astrid agent will monitor and retry any failures.'}
        </p>
        {mode === 'split' && (
          <div className="mb-6">
            <div className="text-xs text-gray-500 mb-2">Shareable join link:</div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-orange-300 text-sm flex-1 truncate font-mono">{shareUrl}</span>
              <motion.button
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/30 transition-colors flex-shrink-0"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Copy
              </motion.button>
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-center flex-wrap">
          <motion.button
            onClick={() => navigate('/splits')}
            className="px-6 py-3 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            View My Splits
          </motion.button>
          <motion.button
            onClick={() => { setCreatedId(null); setTitle(''); setRecipients([]); setTotalAmount(''); }}
            className="px-6 py-3 rounded-xl border border-orange-500/30 text-orange-400 font-medium hover:bg-orange-500/10 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Create Another
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          {mode === 'split' ? 'What are you splitting?' : 'Payout Description'}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={mode === 'split' ? "e.g. Dinner at Mario's" : 'e.g. Monthly Payroll #3'}
          className="w-full px-4 py-3 rounded-xl border border-orange-500/20 bg-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/60 transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Token</label>
        <TokenSelector selected={token} onChange={setToken} balances={balances} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Distribution</label>
        <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-orange-500/10">
          {(['equal', 'custom'] as DistributionType[]).map((d) => (
            <motion.button
              key={d}
              type="button"
              onClick={() => setDistribution(d)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                distribution === d ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'text-gray-400 hover:text-white'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {d === 'equal' ? '⚖️ Equal Split' : '✏️ Custom Amounts'}
            </motion.button>
          ))}
        </div>
      </div>

      {distribution === 'equal' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Total Amount ({token.symbol})
          </label>
         <div className="flex gap-2">
  <input
    type="number"
    min="0"
    step="any"
    value={totalAmount}
    onChange={(e) => setTotalAmount(e.target.value)}
    placeholder="0.00"
    className="flex-1 px-4 py-3 rounded-xl border border-orange-500/20 bg-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/60 transition-colors"
  />
  <button type="button" onClick={() => {
    const bal = balances[token.coinId];
    if (bal) setTotalAmount(bal);
  }} className="px-4 py-3 rounded-xl bg-orange-500/20 text-orange-400 text-xs font-bold border border-orange-500/30 hover:bg-orange-500/30">
    MAX
  </button>
</div>
          {recipients.length > 0 && totalAmount && (
            <div className="mt-2 text-xs text-orange-400">≈ {perPersonAmount()} {token.symbol} per person</div>
          )}
        </motion.div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-300">
            Recipients ({recipients.filter((r) => r.status !== 'invalid').length})
          </label>
          <button type="button" onClick={() => setShowCSV(!showCSV)} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
            {showCSV ? '− Hide CSV' : '+ CSV Import'}
          </button>
        </div>

        <AnimatePresence>
          {showCSV && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden"
            >
              <div className="p-3 rounded-xl bg-white/5 border border-orange-500/10">
                <p className="text-xs text-gray-500 mb-2">
                  {distribution === 'equal' ? 'One wallet address per line' : 'Format: wallet,amount (one per line)'}
                </p>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={5}
                  placeholder={distribution === 'equal' ? '@alice\n@bob\n0xabc123...' : '@alice,100\n@bob,250\n0xabc123...,50'}
                  className="w-full bg-transparent text-white text-xs font-mono placeholder-gray-600 focus:outline-none resize-none"
                />
                <motion.button
                  type="button"
                  onClick={handleCSVImport}
                  className="mt-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-semibold hover:bg-orange-500/30 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Import
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
            placeholder="@username or wallet address"
            className="flex-1 px-3 py-2.5 rounded-xl border border-orange-500/20 bg-white/5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-orange-500/60 transition-colors"
          />
          {distribution === 'custom' && (
            <input
              type="number"
              min="0"
              step="any"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="Amount"
              className="w-28 px-3 py-2.5 rounded-xl border border-orange-500/20 bg-white/5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-orange-500/60 transition-colors"
            />
          )}
          <motion.button
            type="button"
            onClick={addRecipient}
            className="px-4 py-2.5 rounded-xl bg-orange-500 text-black font-bold text-sm hover:bg-orange-400 transition-colors flex-shrink-0"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            +
          </motion.button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          <AnimatePresence>
            {recipients.map((r, i) => (
              <motion.div
                key={`${r.wallet}-${i}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm ${
                  r.status === 'invalid' ? 'border-red-500/30 bg-red-500/5' : r.status === 'valid' ? 'border-green-500/20 bg-green-500/5' : 'border-orange-500/10 bg-white/3'
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="flex-shrink-0">
                  {r.status === 'checking' || r.status === 'pending' ? (
                    <motion.div className="w-4 h-4 border-2 border-orange-500/40 border-t-orange-500 rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : r.status === 'valid' ? (
                    <span className="text-green-400 text-xs">✓</span>
                  ) : (
                    <span className="text-red-400 text-xs">✗</span>
                  )}
                </div>
                <span className={`flex-1 font-mono truncate ${r.status === 'invalid' ? 'text-red-400' : 'text-gray-300'}`}>
                  {r.wallet}
                </span>
                {distribution === 'custom' && r.amount && (
                  <span className="text-orange-300 text-xs flex-shrink-0">{r.amount} {token.symbol}</span>
                )}
                {distribution === 'equal' && totalAmount && recipients.length > 0 && (
                  <span className="text-gray-500 text-xs flex-shrink-0">{perPersonAmount()} {token.symbol}</span>
                )}
                <button type="button" onClick={() => removeRecipient(i)} className="text-gray-600 hover:text-red-400 transition-colors text-xs flex-shrink-0">✕</button>
              </motion.div>
            ))}
          </AnimatePresence>
          {recipients.length === 0 && (
            <div className="text-center py-6 text-gray-600 text-sm">Add recipients using the field above or CSV import</div>
          )}
        </div>

        {distribution === 'custom' && recipients.length > 0 && (
          <div className="mt-2 text-xs text-orange-400 text-right">Total: {totalCustomAmount()} {token.symbol}</div>
        )}
      </div>

     <div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Deadline (optional)</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-orange-500/20 bg-white/5 text-white text-sm focus:outline-none focus:border-orange-500/60 transition-colors"
          />
        </div>
        
      </div>

      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-xs text-gray-500">
        ℹ️ Network fees apply. Exact fee is determined by the Unicity aggregator at submission time.
      </div>

      {error && (
        <motion.div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          {error}
        </motion.div>
      )}

      <motion.button
        type="submit"
        disabled={submitting || recipients.filter((r) => r.status === 'valid').length === 0}
        className="w-full py-4 rounded-2xl font-black text-lg text-black bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25 transition-all"
        whileHover={{ scale: submitting ? 1 : 1.02 }}
        whileTap={{ scale: submitting ? 1 : 0.98 }}
      >
        {submitting ? (
          <div className="flex items-center justify-center gap-2">
            <motion.div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
            {mode === 'split' ? 'Creating Split...' : 'Sending Payouts...'}
          </div>
        ) : mode === 'split' ? (
          `🔗 Create Split & Share Link`
        ) : (
          `🚀 Send Bulk Payout (${recipients.filter((r) => r.status === 'valid').length} recipients)`
        )}
      </motion.button>
    </form>
  );
}