export type AppMode = 'split' | 'payout';
export type DistributionType = 'equal' | 'custom';
export type SplitStatus = 'open' | 'settled' | 'expired';

export interface TokenInfo {
  symbol: string;
  name: string;
  coinId: string;
  decimals: number;
  icon: string;
  color: string;
}

export interface SplitMember {
  id: string;
  splitId: string;
  walletAddress: string;
  amountOwed: bigint;
  paid: boolean;
  paidAt?: string;
  reminderCount: number;
  lastRemindedAt?: string;
  invalidAddress: boolean;
  retryCount: number;
}

export interface Split {
  id: string;
  mode: AppMode;
  title: string;
  coinId: string;
  tokenSymbol: string;
  totalAmount: bigint;
  distributionType: DistributionType;
  creatorWallet: string;
  deadline?: string;
  status: SplitStatus;
  requireApproval: boolean;
  createdAt: string;
  members?: SplitMember[];
}

export interface Payment {
  id: string;
  splitId: string;
  fromWallet: string;
  toWallet: string;
  coinId: string;
  amount: bigint;
  txnHash?: string;
  receiptSignature?: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  walletAddress: string;
  coinId: string;
  splitsCreated: number;
  totalPaid: bigint;
  fastestPaySeconds?: number;
  timesSettled: number;
  reliabilityScore: number;
  updatedAt: string;
}

export interface RecipientRow {
  wallet: string;
  amount?: string;
  status: 'pending' | 'valid' | 'invalid' | 'checking';
  errorMsg?: string;
}

export interface WalletIdentity {
  address: string;
  nametag?: string;
  chainPubkey?: string;
}

export interface ConnectState {
  connected: boolean;
  identity: WalletIdentity | null;
  client: any | null;
  disconnect: (() => Promise<void>) | null;
  connecting: boolean;
  error: string | null;
}

export interface PublicFeedItem {
  id: string;
  mode: AppMode;
  tokenSymbol: string;
  totalAmount: string;
  recipientCount: number;
  createdAt: string;
}
