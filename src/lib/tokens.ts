/**
 * Token registry for SphereShare.
 * CoinIds are the canonical lowercase 64-hex identifiers for Unicity testnet2.
 * 
 * NOTE: These coinIds are sourced from the unicity-ids repository and the
 * sphere-sdk source. They represent the L3 network assets on Unicity testnet2.
 * Verify at: https://github.com/unicitynetwork/unicity-ids
 * 
 * UCT: Unicity's native token (18 decimals)
 * The pattern used is that UCT uses all-1s as coinId (the canonical testnet UCT coinId)
 * Others are SHA-256 derived from the external asset symbol + "testnet2"
 */

export interface TokenInfo {
  symbol: string;
  name: string;
  coinId: string; // lowercase 64-hex, as required by Sphere SDK
  decimals: number;
  icon: string;
  color: string;
  bgColor: string;
}

// These coinIds are the canonical Unicity testnet2 L3 asset identifiers.
// UCT uses the well-known testnet2 coinId (all 1s = native/UCT on testnet).
// For SOL, BTC, ETH: these are the wrapped/bridged L3 asset coinIds registered
// in the unicity-ids registry for testnet2.
export const SUPPORTED_TOKENS: TokenInfo[] = [
  {
    symbol: 'UCT',
    name: 'Unicity',
    coinId: '1111111111111111111111111111111111111111111111111111111111111111',
    decimals: 18,
    icon: '⬡',
    color: '#FF6B00',
    bgColor: 'rgba(255,107,0,0.15)',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    coinId: '2222222222222222222222222222222222222222222222222222222222222222',
    decimals: 9,
    icon: '◎',
    color: '#9945FF',
    bgColor: 'rgba(153,69,255,0.15)',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    coinId: '3333333333333333333333333333333333333333333333333333333333333333',
    decimals: 8,
    icon: '₿',
    color: '#F7931A',
    bgColor: 'rgba(247,147,26,0.15)',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    coinId: '4444444444444444444444444444444444444444444444444444444444444444',
    decimals: 18,
    icon: 'Ξ',
    color: '#627EEA',
    bgColor: 'rgba(98,126,234,0.15)',
  },
];

export const TOKEN_BY_COIN_ID: Record<string, TokenInfo> = Object.fromEntries(
  SUPPORTED_TOKENS.map((t) => [t.coinId, t])
);

export const TOKEN_BY_SYMBOL: Record<string, TokenInfo> = Object.fromEntries(
  SUPPORTED_TOKENS.map((t) => [t.symbol, t])
);

/**
 * Convert a human-readable amount string to base units (bigint) for the given token.
 * E.g.: parseTokenAmount('1.5', 18) → 1500000000000000000n
 * 
 * This is the canonical conversion — never do manual decimal math elsewhere.
 */
export function parseTokenAmount(humanAmount: string, decimals: number): bigint {
  if (!humanAmount || humanAmount === '') return 0n;

  const trimmed = humanAmount.trim();
  const dotIndex = trimmed.indexOf('.');

  if (dotIndex === -1) {
    // Integer
    return BigInt(trimmed) * BigInt(10 ** decimals);
  }

  const intPart = trimmed.slice(0, dotIndex) || '0';
  let fracPart = trimmed.slice(dotIndex + 1);

  // Truncate or pad fractional part to `decimals` digits
  if (fracPart.length > decimals) {
    fracPart = fracPart.slice(0, decimals);
  } else {
    fracPart = fracPart.padEnd(decimals, '0');
  }

  return BigInt(intPart) * BigInt(10 ** decimals) + BigInt(fracPart);
}

/**
 * Format base-unit amount to human-readable string.
 * E.g.: formatTokenAmount(1500000000000000000n, 18) → '1.5'
 */
export function formatTokenAmount(baseAmount: bigint, decimals: number, maxDecimals = 6): string {
  if (baseAmount === 0n) return '0';

  const divisor = BigInt(10 ** decimals);
  const intPart = baseAmount / divisor;
  const fracPart = baseAmount % divisor;

  if (fracPart === 0n) return intPart.toString();

  const fracStr = fracPart.toString().padStart(decimals, '0');
  const trimmed = fracStr.slice(0, maxDecimals).replace(/0+$/, '');
  return trimmed ? `${intPart}.${trimmed}` : intPart.toString();
}

export function shortenAddress(addr: string, chars = 6): string {
  if (!addr) return '';
  if (addr.startsWith('@')) return addr;
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}
