import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOpenSplits, getSplitMembers, updateSplitStatus, upsertLeaderboard } from '../lib/storage';

interface AgentLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warn';
}

/**
 * Simulates the Astrid agent loop running every 60 seconds.
 * In production, this runs as an Astrid capsule (WASM) on AstridOS.
 * Reference: https://github.com/unicity-astrid/astrid
 */
export function useAgentLoop() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [tickCount, setTickCount] = useState(0);

  const addLog = (message: string, type: AgentLog['type'] = 'info') => {
    setLogs((prev) => [
      { id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), message, type },
      ...prev.slice(0, 19),
    ]);
  };

  useEffect(() => {
    addLog('Astrid agent initialized — 60s loop active', 'success');

    const runLoop = () => {
      setTickCount((n) => n + 1);
      const openSplits = getOpenSplits();

      if (openSplits.length === 0) {
        addLog('Agent tick: no open splits to process', 'info');
        return;
      }

      let reminders = 0;
      let settled = 0;

      for (const split of openSplits) {
        const members = getSplitMembers(split.id);
        const unpaid = members.filter((m) => !m.paid);
        const allPaid = unpaid.length === 0 && members.length > 0;

        if (allPaid) {
          // Settle the split
          updateSplitStatus(split.id, 'settled');
          settled++;
          addLog(`✅ Split "${split.title}" settled — all ${members.length} members paid`, 'success');

          // Update leaderboard for creator
          upsertLeaderboard(split.creatorWallet, split.coinId, {
            splitsCreated: 1,
            timesSettled: 1,
          });
          continue;
        }

        // Check deadline
        if (split.deadline && new Date(split.deadline) < new Date()) {
          updateSplitStatus(split.id, 'expired');
          addLog(`⏰ Split "${split.title}" expired`, 'warn');
          continue;
        }

        // Send reminders to unpaid members (simulated — real DMs via sphere_intent dm)
        for (const member of unpaid) {
          const hoursSinceReminder = member.lastRemindedAt
            ? (Date.now() - new Date(member.lastRemindedAt).getTime()) / 3600000
            : Infinity;

          if (hoursSinceReminder >= 24 || !member.lastRemindedAt) {
            // In production: await client.intent('dm', { to: member.walletAddress, message: '...' })
            reminders++;
            addLog(`📨 Reminder sent to ${member.walletAddress.slice(0, 12)}... for "${split.title}"`, 'info');
          }
        }
      }

      if (reminders > 0 || settled > 0) {
        addLog(`Agent tick: ${reminders} reminder(s), ${settled} settlement(s)`, 'success');
      } else {
        addLog(`Agent tick: ${openSplits.length} open split(s) monitored`, 'info');
      }
    };

    // Run immediately
    setTimeout(runLoop, 2000);

    // Then every 60 seconds
    const interval = setInterval(runLoop, 60000);
    return () => clearInterval(interval);
  }, []);

  return { logs, tickCount };
}

export default function AgentStatusPanel() {
  const { logs, tickCount } = useAgentLoop();
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-40"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2 }}
    >
      {/* Toggle button */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-orange-500/30 text-sm font-semibold shadow-lg"
        style={{ background: 'rgba(10,5,0,0.95)', backdropFilter: 'blur(20px)' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          className="w-2 h-2 rounded-full bg-green-400"
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-green-400">Astrid</span>
        <span className="text-gray-500 text-xs">tick #{tickCount}</span>
        <motion.span
          className="text-gray-500 text-xs"
          animate={{ rotate: expanded ? 180 : 0 }}
        >
          ▼
        </motion.span>
      </motion.button>

      {/* Log panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="absolute bottom-12 right-0 w-80 rounded-2xl border border-orange-500/20 overflow-hidden"
            style={{ background: 'rgba(10,5,0,0.98)', backdropFilter: 'blur(20px)' }}
            initial={{ opacity: 0, height: 0, scaleY: 0 }}
            animate={{ opacity: 1, height: 'auto', scaleY: 1 }}
            exit={{ opacity: 0, height: 0, scaleY: 0 }}
          >
            <div className="p-3 border-b border-orange-500/10 flex items-center gap-2">
              <span className="text-orange-400 text-xs font-bold uppercase tracking-wider">🤖 Astrid Agent Log</span>
              <span className="text-gray-600 text-xs ml-auto">60s loop</span>
            </div>
            <div className="p-2 max-h-52 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-gray-600 text-xs p-2 text-center">Starting up...</div>
              ) : (
                logs.map((log) => (
                  <motion.div
                    key={log.id}
                    className={`text-xs px-2 py-1.5 rounded-lg ${
                      log.type === 'success'
                        ? 'text-green-400 bg-green-500/5'
                        : log.type === 'warn'
                        ? 'text-yellow-400 bg-yellow-500/5'
                        : 'text-gray-400 bg-white/3'
                    }`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <span className="text-gray-600 mr-1">{log.time}</span>
                    {log.message}
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
