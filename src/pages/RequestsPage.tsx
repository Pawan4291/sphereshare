import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { getMemberSplits, markMemberPaid, recordPayment } from '../lib/storage';
import { formatTokenAmount, TOKEN_BY_SYMBOL, TOKEN_BY_COIN_ID, shortenAddress } from '../lib/tokens';
import { getErrorMessage, ERROR_CODES } from '../lib/sphere';
import { supabase } from '../lib/storage';

interface RequestItem {
  split: import('../types').Split;
  member: import('../types').SplitMember;
}

export default function RequestsPage() {
  const { connected, identity, client } = useWallet();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (!identity?.address) return;
  const load = async () => {
    const data = await getMemberSplits(identity.nametag ?? identity.address);
    setRequests(data);
  };
  load();
  const interval = setInterval(load, 15000);
const channel = supabase
  .channel('requests-sync')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'split_members',
  }, () => load())
  .subscribe();
  // When payment comes in from wallet — mark paid in Supabase
  const unsubIncoming = client?.on('transfer:incoming', async (data: any) => {
    // Find matching pending member and mark paid
    const pending = requests.filter(r => !r.member.paid);
    for (const item of pending) {
      if (data?.coinId === item.split.coinId) {
        await markMemberPaid(item.member.id);
        await import('../lib/storage').then(({ upsertLeaderboard }) => 
  upsertLeaderboard(identity?.address ?? '', item.split.coinId, {
    totalPaid: item.member.amountOwed,
    timesSettled: 1,
  })
);
      }
    }
    load();
  });

  return () => {
  clearInterval(interval);
  unsubIncoming?.();
  channel.unsubscribe();
};
}, [identity?.address, client]);

  const handlePay = async (item: RequestItem) => {
    if (!client) return;
    setPaying(item.member.id);
    setError(null);
    try {
      const result = await client.intent('send', {
        to: item.split.creatorWallet,
        amount: item.member.amountOwed.toString(),
        coinId: item.split.coinId,
      });
      await markMemberPaid(item.member.id);
      await recordPayment({
        splitId: item.split.id,
        fromWallet: identity?.address ?? '',
        toWallet: item.split.creatorWallet,
        coinId: item.split.coinId,
        amount: item.member.amountOwed,
        txnHash: (result as any)?.txnHash ?? (result as any)?.hash ?? undefined,
      });
      if (identity?.address) {
        const data = await getMemberSplits(identity?.nametag ?? identity?.address ?? '');
        setRequests(data);
      }
    } catch (err: any) {
      const code = (err as { code?: number })?.code;
      if (code !== ERROR_CODES.USER_REJECTED && code !== ERROR_CODES.INTENT_CANCELLED) {
        setError(code ? getErrorMessage(code) : err?.message ?? 'Payment failed.');
      }
    } finally {
      setPaying(null);
    }
  };

 const pending = requests.filter((r) => !r.member.paid && !r.member.invalidAddress && r.split.status === 'open');
  const paidItems = requests.filter((r) => r.member.paid);
const declinedItems = requests.filter((r) => r.member.invalidAddress);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-black text-white mb-2">Payment <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Requests</span></h1>
          <p className="text-gray-400">Bills and splits you've been added to.</p>
        </motion.div>

        {!connected ? (
          <div className="text-center py-20 text-gray-600"><div className="text-6xl mb-4">📨</div><p>Connect your wallet to view payment requests.</p></div>
        ) : (
          <div className="space-y-6">
            {error && <motion.div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}

            {pending.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-white mb-4">Pending ({pending.length})</h2>
                <div className="space-y-3">
                  {pending.map((item) => {
                    const token = TOKEN_BY_SYMBOL[item.split.tokenSymbol] ?? TOKEN_BY_COIN_ID[item.split.coinId];
                    return (
                      <motion.div key={item.member.id} className="p-5 rounded-2xl border border-orange-500/30 bg-orange-500/5 flex items-start gap-4 flex-wrap"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ borderColor: 'rgba(249,115,22,0.5)' }}>
                        <div className="text-2xl">{item.split.mode === 'split' ? '🍕' : '💸'}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white">{item.split.title}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-orange-400 font-bold text-lg">{formatTokenAmount(item.member.amountOwed, token?.decimals ?? 18)} {item.split.tokenSymbol}</span>
                            <span className="text-xs text-gray-500">from {shortenAddress(item.split.creatorWallet)}</span>
                          </div>
                          {item.split.deadline && <div className="text-xs text-gray-500 mt-1">Due: {new Date(item.split.deadline).toLocaleDateString()}</div>}
                          {item.member.reminderCount > 0 && <div className="text-xs text-yellow-600 mt-1">🔔 {item.member.reminderCount} reminder{item.member.reminderCount > 1 ? 's' : ''} received</div>}
                        </div>
                        <motion.button onClick={() => handlePay(item)} disabled={paying === item.member.id}
                          className="px-6 py-3 rounded-xl font-black text-black bg-gradient-to-r from-orange-400 to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25 flex-shrink-0"
                          whileHover={{ scale: paying === item.member.id ? 1 : 1.05 }} whileTap={{ scale: paying === item.member.id ? 1 : 0.95 }}>
                          {paying === item.member.id ? 'Paying...' : `Pay ${formatTokenAmount(item.member.amountOwed, token?.decimals ?? 18)} ${item.split.tokenSymbol}`}
                          
                        </motion.button>
                        <motion.button
  onClick={async () => {
    await markMemberPaid(item.member.id);
    const data = await getMemberSplits(identity?.nametag ?? identity?.address ?? '');
    setRequests(data);
  }}
  className="px-4 py-3 rounded-xl font-bold text-green-400 border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 flex-shrink-0 text-sm"
  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
  ✓ Already Paid
</motion.button>
<motion.button
  onClick={async () => {
    await markMemberPaid(item.member.id, 'declined');
    const data = await getMemberSplits(identity?.nametag ?? identity?.address ?? '');
    setRequests(data);
  }}
  className="px-4 py-3 rounded-xl font-bold text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 flex-shrink-0 text-sm"
  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
  ✕ Decline
</motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

           {paidItems.length > 0 && (
  <div>
    <h2 className="text-lg font-bold text-green-400 mb-4">Paid ({paidItems.length})</h2>
    <div className="space-y-2">
      {paidItems.map((item) => {
        const token = TOKEN_BY_SYMBOL[item.split.tokenSymbol] ?? TOKEN_BY_COIN_ID[item.split.coinId];
        return (
          <motion.div key={item.member.id} className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 flex items-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="text-xl text-green-400">✓</span>
            <div className="flex-1">
              <span className="text-gray-300 font-medium">{item.split.title}</span>
              {item.member.paidAt && <div className="text-xs text-gray-600 mt-1">{new Date(item.member.paidAt).toLocaleString()}</div>}
            </div>
            <span className="text-xs text-green-500">Paid</span>
          </motion.div>
        );
      })}
    </div>
  </div>
)}

{declinedItems.length > 0 && (
  <div>
    <h2 className="text-lg font-bold text-red-400 mb-4 mt-6">Declined ({declinedItems.length})</h2>
    <div className="space-y-2">
      {declinedItems.map((item) => {
        const token = TOKEN_BY_SYMBOL[item.split.tokenSymbol] ?? TOKEN_BY_COIN_ID[item.split.coinId];
        return (
          <motion.div key={item.member.id} className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="text-xl text-red-400">✕</span>
            <div className="flex-1">
              <span className="text-gray-300 font-medium">{item.split.title}</span>
             {item.member.paidAt && <div className="text-xs text-gray-600 mt-1">{new Date(item.member.paidAt).toLocaleString()}</div>}
            </div>
            <span className="text-xs text-red-500">Declined</span>
          </motion.div>
        );
      })}
    </div>
  </div>
)}

            {pending.length === 0 && paidItems.length === 0 && declinedItems.length === 0 && (
              <div className="text-center py-20"><div className="text-6xl mb-4">🎉</div><p className="text-gray-500">No payment requests. You're all settled up!</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}