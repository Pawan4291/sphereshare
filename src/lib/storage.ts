/**
 * Local storage layer for SphereShare.
 * In production, this would use Supabase. For the demo build, we use localStorage
 * to persist splits/payments locally so the UI is fully functional.
 */

import type { Split, SplitMember, Payment, LeaderboardEntry, PublicFeedItem } from '../types';

const KEYS = {
  SPLITS: 'sphereshare_splits',
  MEMBERS: 'sphereshare_members',
  PAYMENTS: 'sphereshare_payments',
  LEADERBOARD: 'sphereshare_leaderboard',
  FEED: 'sphereshare_feed',
};

function genId(): string {
  return crypto.randomUUID();
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Splits ─────────────────────────────────────────────────────────────────

export type StoredSplit = Omit<Split, 'totalAmount'> & { totalAmount: string };
export type StoredMember = Omit<SplitMember, 'amountOwed'> & { amountOwed: string };
export type StoredPayment = Omit<Payment, 'amount'> & { amount: string };

export function createSplit(data: Omit<Split, 'id' | 'createdAt'>): Split {
  const splits = read<StoredSplit>(KEYS.SPLITS);
  const newSplit: StoredSplit = {
    ...data,
    id: genId(),
    createdAt: new Date().toISOString(),
    totalAmount: data.totalAmount.toString(),
  };
  splits.push(newSplit);
  write(KEYS.SPLITS, splits);

  // Add to public feed (anonymized)
  addToFeed({
    id: genId(),
    mode: data.mode,
    tokenSymbol: data.tokenSymbol,
    totalAmount: data.totalAmount.toString(),
    recipientCount: 0,
    createdAt: newSplit.createdAt,
  });

  return deserializeSplit(newSplit);
}

export function getSplit(id: string): Split | null {
  const splits = read<StoredSplit>(KEYS.SPLITS);
  const s = splits.find((x) => x.id === id);
  return s ? deserializeSplit(s) : null;
}

export function getUserSplits(walletAddress: string): Split[] {
  const splits = read<StoredSplit>(KEYS.SPLITS);
  return splits
    .filter((s) => s.creatorWallet === walletAddress)
    .map(deserializeSplit)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateSplitStatus(id: string, status: Split['status']): void {
  const splits = read<StoredSplit>(KEYS.SPLITS);
  const idx = splits.findIndex((s) => s.id === id);
  if (idx !== -1) {
    splits[idx].status = status;
    write(KEYS.SPLITS, splits);
  }
}

export function getOpenSplits(): Split[] {
  return read<StoredSplit>(KEYS.SPLITS)
    .filter((s) => s.status === 'open')
    .map(deserializeSplit);
}

function deserializeSplit(s: StoredSplit): Split {
  return { ...s, totalAmount: BigInt(s.totalAmount) };
}

// ─── Members ────────────────────────────────────────────────────────────────

export function addMember(data: Omit<SplitMember, 'id'>): SplitMember {
  const members = read<StoredMember>(KEYS.MEMBERS);
  const newMember: StoredMember = {
    ...data,
    id: genId(),
    amountOwed: data.amountOwed.toString(),
  };
  members.push(newMember);
  write(KEYS.MEMBERS, members);

  // Update feed recipient count
  updateFeedRecipientCount(data.splitId);

  return deserializeMember(newMember);
}

export function addMembers(members: Omit<SplitMember, 'id'>[]): SplitMember[] {
  const existing = read<StoredMember>(KEYS.MEMBERS);
  const newMembers: StoredMember[] = members.map((m) => ({
    ...m,
    id: genId(),
    amountOwed: m.amountOwed.toString(),
  }));
  write(KEYS.MEMBERS, [...existing, ...newMembers]);
  if (members.length > 0) updateFeedRecipientCount(members[0].splitId);
  return newMembers.map(deserializeMember);
}

export function getSplitMembers(splitId: string): SplitMember[] {
  return read<StoredMember>(KEYS.MEMBERS)
    .filter((m) => m.splitId === splitId)
    .map(deserializeMember);
}

export function markMemberPaid(memberId: string, paidAt?: string): void {
  const members = read<StoredMember>(KEYS.MEMBERS);
  const idx = members.findIndex((m) => m.id === memberId);
  if (idx !== -1) {
    members[idx].paid = true;
    members[idx].paidAt = paidAt ?? new Date().toISOString();
    write(KEYS.MEMBERS, members);
  }
}

export function getMemberSplits(walletAddress: string): { split: Split; member: SplitMember }[] {
  const members = read<StoredMember>(KEYS.MEMBERS).filter(
    (m) => m.walletAddress === walletAddress
  );
  const result: { split: Split; member: SplitMember }[] = [];
  for (const m of members) {
    const split = getSplit(m.splitId);
    if (split) result.push({ split, member: deserializeMember(m) });
  }
  return result.sort(
    (a, b) => new Date(b.split.createdAt).getTime() - new Date(a.split.createdAt).getTime()
  );
}

function deserializeMember(m: StoredMember): SplitMember {
  return { ...m, amountOwed: BigInt(m.amountOwed) };
}

// ─── Payments ────────────────────────────────────────────────────────────────

export function recordPayment(data: Omit<Payment, 'id' | 'createdAt'>): Payment {
  const payments = read<StoredPayment>(KEYS.PAYMENTS);
  const newPayment: StoredPayment = {
    ...data,
    id: genId(),
    createdAt: new Date().toISOString(),
    amount: data.amount.toString(),
  };
  payments.push(newPayment);
  write(KEYS.PAYMENTS, payments);
  return deserializePayment(newPayment);
}

export function getSplitPayments(splitId: string): Payment[] {
  return read<StoredPayment>(KEYS.PAYMENTS)
    .filter((p) => p.splitId === splitId)
    .map(deserializePayment);
}

function deserializePayment(p: StoredPayment): Payment {
  return { ...p, amount: BigInt(p.amount) };
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export type StoredLeaderboardEntry = Omit<LeaderboardEntry, 'totalPaid'> & { totalPaid: string };

export function upsertLeaderboard(
  walletAddress: string,
  coinId: string,
  delta: Partial<{
    splitsCreated: number;
    totalPaid: bigint;
    fastestPaySeconds: number;
    timesSettled: number;
    reliabilityScore: number;
  }>
): void {
  const board = read<StoredLeaderboardEntry>(KEYS.LEADERBOARD);
  const idx = board.findIndex((e) => e.walletAddress === walletAddress && e.coinId === coinId);

  if (idx === -1) {
    board.push({
      id: genId(),
      walletAddress,
      coinId,
      splitsCreated: delta.splitsCreated ?? 0,
      totalPaid: (delta.totalPaid ?? 0n).toString(),
      fastestPaySeconds: delta.fastestPaySeconds,
      timesSettled: delta.timesSettled ?? 0,
      reliabilityScore: delta.reliabilityScore ?? 100,
      updatedAt: new Date().toISOString(),
    });
  } else {
    const entry = board[idx];
    if (delta.splitsCreated) entry.splitsCreated += delta.splitsCreated;
    if (delta.totalPaid) {
      entry.totalPaid = (BigInt(entry.totalPaid) + delta.totalPaid).toString();
    }
    if (delta.fastestPaySeconds !== undefined) {
      if (!entry.fastestPaySeconds || delta.fastestPaySeconds < entry.fastestPaySeconds) {
        entry.fastestPaySeconds = delta.fastestPaySeconds;
      }
    }
    if (delta.timesSettled) entry.timesSettled += delta.timesSettled;
    if (delta.reliabilityScore !== undefined) entry.reliabilityScore = delta.reliabilityScore;
    entry.updatedAt = new Date().toISOString();
  }

  write(KEYS.LEADERBOARD, board);
}

export function getLeaderboard(coinId?: string): LeaderboardEntry[] {
  const board = read<StoredLeaderboardEntry>(KEYS.LEADERBOARD);
  const filtered = coinId ? board.filter((e) => e.coinId === coinId) : board;
  return filtered
    .map((e) => ({ ...e, totalPaid: BigInt(e.totalPaid) }))
    .sort((a, b) => Number(b.totalPaid - a.totalPaid));
}

// ─── Public Feed ─────────────────────────────────────────────────────────────

function addToFeed(item: PublicFeedItem): void {
  const feed = read<PublicFeedItem>(KEYS.FEED);
  feed.unshift(item);
  if (feed.length > 50) feed.pop();
  write(KEYS.FEED, feed);
}

function updateFeedRecipientCount(splitId: string): void {
  const feed = read<PublicFeedItem>(KEYS.FEED);
  const members = read<StoredMember>(KEYS.MEMBERS).filter((m) => m.splitId === splitId);
  const idx = feed.findIndex((f) => f.id === splitId);
  if (idx !== -1) {
    feed[idx].recipientCount = members.length;
    write(KEYS.FEED, feed);
  }
}

export function getPublicFeed(): PublicFeedItem[] {
  return read<PublicFeedItem>(KEYS.FEED);
}
