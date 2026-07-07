import { WebSocket } from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import { Sphere } from '@unicitylabs/sphere-sdk';
import { createNodeProviders } from '@unicitylabs/sphere-sdk/impl/nodejs';
import { createWalletApiProviders } from '@unicitylabs/sphere-sdk/impl/shared/wallet-api';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAX_RETRY_ATTEMPTS = 3;
let agentSphere = null;

async function initAgentWallet() {
  import fs from 'fs';
fs.mkdirSync('/tmp/sphere-data', { recursive: true });
fs.mkdirSync('/tmp/sphere-tokens', { recursive: true });
  const base = createNodeProviders({
    network: 'testnet',
    oracle: { apiKey: 'sk_ddc3cfcc001e4a28ac3fad7407f99590' },
    dataDir: '/tmp/sphere-data',
tokensDir: '/tmp/sphere-tokens',
  });
  const providers = createWalletApiProviders(base, {
    baseUrl: 'https://wallet-api.unicity.network',
    network: 'testnet2',
    deviceId: 'sphereshare-agent',
  });
  const { sphere } = await Sphere.init({
    ...providers,
    network: 'testnet2',
    autoGenerate: true,
    mnemonic: process.env.AGENT_MNEMONIC || undefined,
  });
  agentSphere = sphere;
}

async function processPendingPayouts() {
  const { data: splits, error } = await supabase
    .from('splits')
    .select('*, split_members(*)')
    .eq('agent_payout_pending', true);
  if (error) throw error;

  for (const split of splits ?? []) {
    let refundAmount = 0n;

    for (const member of split.split_members) {
      if (member.paid || member.invalid_address) continue;

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
      } catch (err) {
        const newRetryCount = (member.retry_count ?? 0) + 1;
        if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
          await supabase.from('split_members').update({
            invalid_address: true,
            retry_count: newRetryCount,
          }).eq('id', member.id);
          refundAmount += BigInt(member.amount_owed);
        } else {
          await supabase.from('split_members').update({
            retry_count: newRetryCount,
          }).eq('id', member.id);
        }
      }
    }

    const { data: freshMembers } = await supabase
      .from('split_members').select('*').eq('split_id', split.id);
    const stillPending = (freshMembers ?? []).some(m => !m.paid && !m.invalid_address);

    if (!stillPending) {
      if (refundAmount > 0n) {
        try {
          await agentSphere.payments.send({
            recipient: split.creator_wallet,
            amount: refundAmount.toString(),
            coinId: split.coin_id,
          });
        } catch {
          continue;
        }
      }
      await supabase.from('splits').update({
        agent_payout_pending: false,
        status: 'settled',
      }).eq('id', split.id);
    }
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'] ?? req.headers['upstash-forward-authorization'] ?? '';
const secret = authHeader.replace('Bearer ', '') || req.query.secret;
if (secret !== process.env.AGENT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await initAgentWallet();
    await processPendingPayouts();
    res.status(200).json({ ok: true, ranAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}