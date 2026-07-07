/**
 * Supabase storage layer for SphereShare.
 * All data persists server-side so the GitHub Actions agent can read/write it.
 */

import { createClient } from '@supabase/supabase-js';
import type { Split, SplitMember, Payment, LeaderboardEntry, PublicFeedItem } from '../types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

function genId(): string { return crypto.randomUUID(); }

// ─── Splits ──────────────────────────────────────────────────────────────────

export async function createSplit(data: Omit<Split, 'id' | 'createdAt'>): Promise<Split> {
  const { data: row, error } = await supabase.from('splits').insert({
    id: genId(),
    mode: data.mode,
    title: data.title,
    coin_id: data.coinId,
    token_symbol: data.tokenSymbol,
   total_amount: data.totalAmount.toString(),
    distribution_type: data.distributionType,
    creator_wallet: data.creatorWallet,
    deadline: data.deadline,
    status: data.status ?? 'open',
    require_approval: data.requireApproval ?? false,
    created_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return rowToSplit(row);
}

export async function deleteSplit(id: string): Promise<void> {
  await supabase.from('split_members').delete().eq('split_id', id);
  await supabase.from('splits').delete().eq('id', id);
}

export async function getSplit(id: string): Promise<Split | null> {
  const { data, error } = await supabase.from('splits').select('*').eq('id', id).single();
  if (error || !data) return null;
  return rowToSplit(data);
}

export async function getUserSplits(walletAddress: string): Promise<Split[]> {
  const { data, error } = await supabase
    .from('splits').select('*')
    .eq('creator_wallet', walletAddress)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToSplit);
}

export async function updateSplitStatus(id: string, status: Split['status']): Promise<void> {
  const { error } = await supabase.from('splits').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function getOpenSplits(): Promise<Split[]> {
  const { data, error } = await supabase.from('splits').select('*').eq('status', 'open');
  if (error) throw error;
  return (data ?? []).map(rowToSplit);
}

function rowToSplit(row: any): Split {
  return {
    id: row.id,
    mode: row.mode,
    title: row.title,
    coinId: row.coin_id,
    tokenSymbol: row.token_symbol,
    totalAmount: BigInt(row.total_amount),
    distributionType: row.distribution_type,
    creatorWallet: row.creator_wallet,
    deadline: row.deadline,
    status: row.status,
    requireApproval: row.require_approval,
    createdAt: row.created_at,
  };
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function addMember(data: Omit<SplitMember, 'id'>): Promise<SplitMember> {
  const { data: row, error } = await supabase.from('split_members').insert({
    id: genId(),
    split_id: data.splitId,
    wallet_address: data.walletAddress,
   amount_owed: data.amountOwed.toString(),
    paid: false,
    reminder_count: 0,
    invalid_address: false,
    retry_count: 0,
  }).select().single();
  if (error) throw error;
  return rowToMember(row);
}

export async function addMembers(members: Omit<SplitMember, 'id'>[]): Promise<SplitMember[]> {
  const rows = members.map((m) => ({
    id: genId(),
    split_id: m.splitId,
    wallet_address: m.walletAddress,
    amount_owed: m.amountOwed.toString(),
    paid: false,
    reminder_count: 0,
    invalid_address: false,
    retry_count: 0,
  }));
  const { data, error } = await supabase.from('split_members').insert(rows).select();
  if (error) throw error;
  return (data ?? []).map(rowToMember);
}

export async function getSplitMembers(splitId: string): Promise<SplitMember[]> {
  const { data, error } = await supabase.from('split_members').select('*').eq('split_id', splitId);
  if (error) throw error;
  return (data ?? []).map(rowToMember);
}

export async function getMemberSplits(walletAddress: string): Promise<{ split: Split; member: SplitMember }[]> {
  const withAt = walletAddress.startsWith('@') ? walletAddress : `@${walletAddress}`;
  const withoutAt = walletAddress.startsWith('@') ? walletAddress.slice(1) : walletAddress;
  
  const { data, error } = await supabase
    .from('split_members')
    .select('*, splits(*)')
    .in('wallet_address', [walletAddress, withAt, withoutAt]);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    split: rowToSplit(row.splits),
    member: rowToMember(row),
  }));
}

export async function markMemberPaid(memberId: string, paidAt?: string): Promise<void> {
  const { error } = await supabase.from('split_members').update({
    paid: paidAt !== 'declined',
    paid_at: paidAt !== 'declined' ? (paidAt ?? new Date().toISOString()) : null,
    invalid_address: paidAt === 'declined',
  }).eq('id', memberId);
  if (error) throw error;
}

export async function incrementReminderCount(memberId: string): Promise<void> {
  const { data } = await supabase.from('split_members').select('reminder_count').eq('id', memberId).single();
  if (!data) return;
  await supabase.from('split_members').update({
    reminder_count: (data.reminder_count ?? 0) + 1,
    last_reminded_at: new Date().toISOString(),
  }).eq('id', memberId);
}

function rowToMember(row: any): SplitMember {
  return {
    id: row.id,
    splitId: row.split_id,
    walletAddress: row.wallet_address,
    amountOwed: BigInt(row.amount_owed),
    paid: row.paid,
    paidAt: row.paid_at,
    reminderCount: row.reminder_count,
    lastRemindedAt: row.last_reminded_at,
    invalidAddress: row.invalid_address,
    retryCount: row.retry_count,
  };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function recordPayment(data: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
  const { data: row, error } = await supabase.from('payments').insert({
    id: genId(),
    split_id: data.splitId,
    from_wallet: data.fromWallet,
    to_wallet: data.toWallet,
    coin_id: data.coinId,
    amount: data.amount.toString(),
    txn_hash: data.txnHash,
    receipt_signature: data.receiptSignature,
    created_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return rowToPayment(row);
}

export async function getSplitPayments(splitId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('*').eq('split_id', splitId);
  if (error) throw error;
  return (data ?? []).map(rowToPayment);
}

function rowToPayment(row: any): Payment {
  return {
    id: row.id,
    splitId: row.split_id,
    fromWallet: row.from_wallet,
    toWallet: row.to_wallet,
    coinId: row.coin_id,
    amount: BigInt(row.amount),
    txnHash: row.txn_hash,
    receiptSignature: row.receipt_signature,
    createdAt: row.created_at,
  };
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function upsertLeaderboard(
  walletAddress: string, coinId: string,
  delta: Partial<{ totalPaid: bigint; fastestPaySeconds: number; timesSettled: number }>
): Promise<void> {
  const { error } = await supabase.rpc('increment_leaderboard', {
    p_wallet: walletAddress,
    p_coin: coinId,
    p_total_paid: (delta.totalPaid ?? 0n).toString(),
    p_times_settled: delta.timesSettled ?? 0,
    p_fastest: delta.fastestPaySeconds ?? null,
  });
  if (error) throw error;
}

export async function getLeaderboard(coinId?: string): Promise<LeaderboardEntry[]> {
  let query = supabase.from('leaderboard').select('*').order('total_paid', { ascending: false });
  if (coinId) query = query.eq('coin_id', coinId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    walletAddress: row.wallet_address,
    coinId: row.coin_id,
    splitsCreated: row.splits_created,
    totalPaid: BigInt(row.total_paid),
    fastestPaySeconds: row.fastest_pay_seconds,
    timesSettled: row.times_settled,
    reliabilityScore: row.reliability_score,
    updatedAt: row.updated_at,
  }));
}

// ─── Public Feed ──────────────────────────────────────────────────────────────

export async function addToFeed(item: Omit<PublicFeedItem, 'id'>): Promise<void> {
  await supabase.from('public_feed').insert({ ...item, id: genId() });
}

export async function getPublicFeed(): Promise<PublicFeedItem[]> {
  const { data, error } = await supabase
    .from('public_feed').select('*')
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}
export { supabase };