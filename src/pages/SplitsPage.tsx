import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { getUserSplits, getSplitMembers, getSplitPayments } from '../lib/storage';
import { formatTokenAmount, TOKEN_BY_SYMBOL, TOKEN_BY_COIN_ID, shortenAddress } from '../lib/tokens';
import { generateExportCSV, downloadCSV } from '../lib/csv';
import type { Split, SplitMember, Payment } from '../types';
import { supabase } from '../lib/storage';
function StatusBadge({ status }: { status: Split['status'] }) {
  const conf = {
    open: { color: 'text-orange-400 bg-orange-500/15 border-orange-500/30', label: 'Open' },
    settled: { color: 'text-green-400 bg-green-500/15 border-green-500/30', label: 'Settled' },
    expired: { color: 'text-gray-400 bg-gray-500/15 border-gray-500/30', label: 'Expired' },
  }[status];
  return <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${conf.color}`}>{conf.label}</span>;
}

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

function SplitCard({ split, onRemove }: { split: Split; onRemove: (id: string) => void }) {
  const [localStatus, setLocalStatus] = useState(split.status);
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<SplitMember[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const token = TOKEN_BY_SYMBOL[split.tokenSymbol] ?? TOKEN_BY_COIN_ID[split.coinId];
  const { client } = useWallet();

  const load = async () => {
    const [m, p] = await Promise.all([getSplitMembers(split.id), getSplitPayments(split.id)]);
    setMembers(m);
    setPayments(p);
  };

 useEffect(() => {
  load();
  if (!expanded) return;
  const interval = setInterval(load, 15000);
  const channel = supabase
  .channel('splits-sync')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'split_members',
    filter: `split_id=eq.${split.id}`,
  }, () => load())
  .subscribe();
  const unsub = client?.on('transfer:incoming', load);
  return () => { clearInterval(interval); unsub?.(); channel.unsubscribe(); };
}, [expanded, split.id, client]);

  const paidCount = members.filter((m) => m.paid).length;
  const shareUrl = `${window.location.origin}/join/${split.id}`;

  const handleExport = () => {
    const rows = members.map((m) => ({
      wallet: m.walletAddress, amount: formatTokenAmount(m.amountOwed, token?.decimals ?? 18),
      token: split.tokenSymbol, txn_hash: '',
      status: m.paid ? 'paid' : m.invalidAddress ? 'declined' : 'pending',
      timestamp: m.paidAt ? new Date(m.paidAt).toISOString() : '',
    }));
    const csv = generateExportCSV(rows, split.title);
    downloadCSV(csv, `sphereshare-${split.id.slice(0, 8)}.csv`);
  };

  return (
    <motion.div className="rounded-2xl border border-orange-500/20 overflow-hidden" style={{ background: 'rgba(15,8,0,0.6)' }}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ borderColor: 'rgba(249,115,22,0.4)' }}>
      <div className="flex items-start gap-4 p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: token?.bgColor ?? 'rgba(255,107,0,0.15)' }}>
          {split.mode === 'split' ? '🍕' : '💸'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white truncate">{split.title}</h3>
            <StatusBadge status={localStatus} />
            <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-gray-500 capitalize">{split.mode}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm font-bold" style={{ color: token?.color ?? '#f97316' }}>{formatTokenAmount(split.totalAmount, token?.decimals ?? 18)} {split.tokenSymbol}</span>
            <span className="text-xs text-gray-500" title={new Date(split.createdAt).toLocaleString()}>{timeAgo(split.createdAt)} · {new Date(split.createdAt).toLocaleString()}</span>
            {split.deadline && new Date(split.deadline) > new Date() && (
  <span className="text-xs text-yellow-600">⏰ Due {new Date(split.deadline).toLocaleDateString()}</span>
)}
{split.deadline && new Date(split.deadline) <= new Date() && localStatus === 'open' && (
  <span className="text-xs text-red-500">⚠️ Overdue</span>
)}
            {members.length > 0 && <span className="text-xs text-gray-500">{paidCount}/{members.length} paid</span>}
          </div>
        </div>
        <motion.div className="text-gray-500 text-sm flex-shrink-0" animate={{ rotate: expanded ? 180 : 0 }}>▼</motion.div>
      </div>

      {members.length > 0 && (
        <div className="px-5 pb-2">
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
              initial={{ width: 0 }} animate={{ width: `${(paidCount / members.length) * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          </div>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-2 border-t border-orange-500/10 space-y-4">
              {members.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Recipients</h4>
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${m.paid ? 'border-green-500/20 bg-green-500/5' : 'border-orange-500/10 bg-white/3'}`}>
                        <span className={m.paid ? 'text-green-400' : m.invalidAddress ? 'text-red-400' : 'text-orange-400'}>
  {m.paid ? '✓' : m.invalidAddress ? '✕' : '○'}
</span>
                        <span className="flex-1 font-mono text-xs text-gray-300 truncate">{shortenAddress(m.walletAddress)}</span>
                        <span className="text-xs" style={{ color: token?.color ?? '#f97316' }}>{formatTokenAmount(m.amountOwed, token?.decimals ?? 18)} {split.tokenSymbol}</span>
                        {m.paid && m.paidAt && <span className="text-xs text-gray-600">{timeAgo(m.paidAt)}</span>}
                        {m.invalidAddress && <span className="text-xs text-red-500">Declined</span>}
                        {!m.paid && m.reminderCount > 0 && <span className="text-xs text-gray-600">{m.reminderCount} reminder{m.reminderCount > 1 ? 's' : ''} sent</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {split.mode === 'split' && (
                  <motion.button onClick={() => navigator.clipboard.writeText(shareUrl)}
                    className="px-4 py-2 rounded-xl bg-orange-500/15 text-orange-400 text-xs font-semibold border border-orange-500/20 hover:bg-orange-500/25"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>📋 Copy Join Link</motion.button>
                )}
               {localStatus === 'open' && split.mode === 'split' && (
  <motion.button onClick={async () => {
  const { updateSplitStatus } = await import('../lib/storage');
  await updateSplitStatus(split.id, 'expired');
  setLocalStatus('expired'); 
  const [m, p] = await Promise.all([getSplitMembers(split.id), getSplitPayments(split.id)]);
  setMembers(m);
  setPayments(p);
}}
    className="px-4 py-2 rounded-xl bg-red-500/15 text-red-400 text-xs font-semibold border border-red-500/20 hover:bg-red-500/25"
    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>🚫 Cancel Split</motion.button>
    
)}

{localStatus === 'expired' && (
  <motion.button onClick={async () => {
    const { deleteSplit } = await import('../lib/storage');
   await deleteSplit(split.id);
    onRemove(split.id);
  }}
    className="px-4 py-2 rounded-xl bg-red-500/15 text-red-400 text-xs font-semibold border border-red-500/20 hover:bg-red-500/25"
    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>🗑️ Delete</motion.button>
)}

<motion.button onClick={handleExport}
  className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 text-xs font-semibold border border-white/10 hover:bg-white/10"
  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>📄 Export CSV</motion.button>
</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SplitsPage() {
  const { connected, identity } = useWallet();
  const [splits, setSplits] = useState<Split[]>([]);
  const [filter, setFilter] = useState<'all' | 'split' | 'payout'>('all');

  useEffect(() => {
    if (!identity?.address) return;
    const load = async () => {
      const data = await getUserSplits(identity.nametag ? `@${identity.nametag}` : identity.address);
      setSplits(data);
    };
    load();
  }, [identity?.address, identity?.nametag]);

  const filtered = splits.filter((s) => filter === 'all' || s.mode === filter);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <motion.div className="mb-8 flex items-start justify-between flex-wrap gap-4" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <h1 className="text-4xl font-black text-white mb-2">My <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Splits & Payouts</span></h1>
            <p className="text-gray-400">All payment groups you've created.</p>
          </div>
          <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-orange-500/10">
            {(['all', 'split', 'payout'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${filter === f ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'}`}>
                {f === 'all' ? 'All' : f === 'split' ? '🍕 Splits' : '💸 Payouts'}
              </button>
            ))}
          </div>
        </motion.div>

        {!connected ? (
          <div className="text-center py-20 text-gray-600"><div className="text-6xl mb-4">🔐</div><p>Connect your wallet to view your splits.</p></div>
        ) : filtered.length === 0 ? (
          <motion.div className="text-center py-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500 mb-4">No {filter !== 'all' ? filter + 's' : 'splits or payouts'} yet.</p>
            <a href="/home" className="text-orange-400 hover:text-orange-300 text-sm">Create your first one →</a>
          </motion.div>
        ) : (
<div className="space-y-4">{filtered.map((split) => <SplitCard key={split.id} split={split} onRemove={(id) => setSplits(prev => prev.filter(s => s.id !== id))} />)}</div>
        )}
      </div>
    </div>
  );
}