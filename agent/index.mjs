/**
 * SphereShare Autonomous Agent
 * Runs via GitHub Actions every 5 minutes.
 * - Sends DM reminders to unpaid members
 * - Detects all-paid splits and closes them
 * - Updates leaderboard
 */
import { WebSocket } from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';


import { Sphere } from '@unicitylabs/sphere-sdk';
import { createNodeProviders } from '@unicitylabs/sphere-sdk/impl/nodejs';
import { createWalletApiProviders } from '@unicitylabs/sphere-sdk/impl/shared/wallet-api';

let agentSphere = null;

async function initAgentWallet() {
  const base = createNodeProviders({
    network: 'testnet',
    oracle: { apiKey: 'sk_ddc3cfcc001e4a28ac3fad7407f99590' },
  });
  const providers = createWalletApiProviders(base, {
    baseUrl: 'https://wallet-api.unicity.network',
    network: 'testnet2',
    deviceId: 'sphereshare-agent',
  });
 const { sphere, created, generatedMnemonic } = await Sphere.init({
    ...providers,
    network: 'testnet2',
    autoGenerate: true,
    mnemonic: process.env.AGENT_MNEMONIC || undefined,
  });
  if (created && generatedMnemonic) {
    console.log('NEW AGENT WALLET — SAVE THIS MNEMONIC AS A GITHUB SECRET (AGENT_MNEMONIC):', generatedMnemonic);
  }
  agentSphere = sphere;
}


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service key for server-side writes
);

const REMINDER_INTERVAL_HOURS = 24;

async function getOpenSplits() {
  const { data, error } = await supabase
    .from('splits').select('*, split_members(*)')
    .eq('status', 'open');
  if (error) throw error;
  return data ?? [];
}

async function sendReminder(split, member) {
  // DM via Sphere HTTP API
  const res = await fetch('https://goggregator-test.unicity.network/dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: member.wallet_address,
      message: `⏰ Reminder: You owe ${formatAmount(member.amount_owed, split.token_symbol)} in "${split.title}". Please pay at https://sphereshare.vercel.app/join/${split.id}`,
    }),
  });
  if (!res.ok) {
    console.log(`DM failed for ${member.wallet_address}: ${res.status}`);
    return false;
  }

  // Update reminder count
  await supabase.from('split_members').update({
    reminder_count: (member.reminder_count ?? 0) + 1,
    last_reminded_at: new Date().toISOString(),
  }).eq('id', member.id);

  console.log(`Reminded ${member.wallet_address} for split ${split.id}`);
  return true;
}

async function closeSplit(split) {
  await supabase.from('splits').update({ status: 'settled' }).eq('id', split.id);

  // Notify everyone via DM
  for (const member of split.split_members) {
    await fetch('https://goggregator-test.unicity.network/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: member.wallet_address,
        message: `✅ "${split.title}" is fully settled! Everyone has paid their share.`,
      }),
    }).catch(() => {});
  }

  // Also notify creator
  await fetch('https://goggregator-test.unicity.network/dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: split.creator_wallet,
      message: `✅ Your split "${split.title}" is fully settled! All ${split.split_members.length} members have paid.`,
    }),
  }).catch(() => {});

  console.log(`Closed split ${split.id} — ${split.title}`);
}

async function updateLeaderboard(split) {
  for (const member of split.split_members) {
    if (!member.paid) continue;
    const { data: existing } = await supabase
      .from('leaderboard').select('*')
      .eq('wallet_address', member.wallet_address)
      .eq('coin_id', split.coin_id).single();

    if (!existing) {
      await supabase.from('leaderboard').insert({
        id: crypto.randomUUID(),
        wallet_address: member.wallet_address,
        coin_id: split.coin_id,
        splits_created: 0,
        total_paid: member.amount_owed,
        times_settled: 1,
        reliability_score: 100,
        updated_at: new Date().toISOString(),
      });
    } else {
      await supabase.from('leaderboard').update({
        total_paid: (BigInt(existing.total_paid) + BigInt(member.amount_owed)).toString(),
        times_settled: existing.times_settled + 1,
        updated_at: new Date().toISOString(),
      }).eq('wallet_address', member.wallet_address).eq('coin_id', split.coin_id);
    }
  }
}

async function processPendingPayouts() {
  const { data: splits, error } = await supabase
    .from('splits')
    .select('*, split_members(*)')
    .eq('agent_payout_pending', true);
  if (error) throw error;

  for (const split of splits ?? []) {
    console.log(`Processing pending payout: ${split.title} (${split.id})`);
    let allSucceeded = true;

    for (const member of split.split_members) {
      if (member.paid) continue;
      try {
        await agentSphere.payments.send({
          recipient: member.wallet_address,
          amount: member.amount_owed.toString(),
          coinId: split.coin_id,
        });
        await supabase.from('split_members').update({
          paid: true,
          paid_at: new Date().toISOString(),
        }).eq('id', member.id);
        console.log(`Paid ${member.wallet_address}: ${member.amount_owed}`);
      } catch (err) {
        allSucceeded = false;
        console.log(`Payout failed for ${member.wallet_address}: ${err.message}`);
      }
    }

    if (allSucceeded) {
      await supabase.from('splits').update({
        agent_payout_pending: false,
        status: 'settled',
      }).eq('id', split.id);
      console.log(`Payout complete for split ${split.id}`);
    }
  }
}


function formatAmount(baseAmount, symbol) {
  const decimals = { UCT: 18, SOL: 9, BTC: 8, ETH: 18, USDU: 6 }[symbol] ?? 18;
  const divisor = BigInt(10 ** decimals);
  const amount = BigInt(baseAmount);
  const int = amount / divisor;
  const frac = amount % divisor;
  if (frac === 0n) return `${int} ${symbol}`;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
  return `${int}.${fracStr} ${symbol}`;
}

function hoursSince(isoString) {
  if (!isoString) return 999;
  return (Date.now() - new Date(isoString).getTime()) / 3_600_000;
}

async function run() {
  await initAgentWallet();
  console.log(`Agent running at ${new Date().toISOString()}`);
  await processPendingPayouts();
  const splits = await getOpenSplits();
  console.log(`Found ${splits.length} open splits`);

  for (const split of splits) {
    const unpaid = split.split_members.filter(m => !m.paid);
    const allPaid = unpaid.length === 0 && split.split_members.length > 0;

    if (allPaid) {
      await closeSplit(split);
      await updateLeaderboard(split);
      continue;
    }

    // Send reminders to unpaid members past 24h threshold
    for (const member of unpaid) {
      const hoursSinceReminder = hoursSince(member.last_reminded_at);
      if (hoursSinceReminder >= REMINDER_INTERVAL_HOURS) {
        await sendReminder(split, member);
      }
    }
  }

  console.log('Agent run complete');
}

run().catch(err => {
  console.error('Agent error:', err);
  process.exit(1);
});
