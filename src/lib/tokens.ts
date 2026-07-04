export interface TokenInfo {
  symbol: string;
  name: string;
  coinId: string;
  decimals: number;
  icon?: string;
  logoUrl: string;
  color: string;
  bgColor: string;
}

export const SUPPORTED_TOKENS: TokenInfo[] = [
  {
    symbol: 'UCT',
    name: 'Unicity',
    coinId: 'f581d30f593e4b369d684a4563b5246f07b1d265f7178a2c0a82b81f39c24dc0',
    decimals: 18,
    icon: 'https://assets.coingecko.com/coins/images/placeholder.png',
    logoUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23FF6B00"/><text x="16" y="21" text-anchor="middle" font-size="16" font-weight="bold" font-family="Arial" fill="white">U</text></svg>',
    color: '#FF6B00',
    bgColor: 'rgba(255,107,0,0.15)',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    coinId: '72f7771d5690afcf89cfc16e8ee8c1a836d0faa8ed1b34d527aabc18acb949ae',
    decimals: 9,
    logoUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    color: '#9945FF',
    bgColor: 'rgba(153,69,255,0.15)',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    coinId: '3cc412d8a24510d424f74de4c471d22298b7f52625af6fd3ecb3c3d9e1a683fb',
    decimals: 8,
    logoUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    color: '#F7931A',
    bgColor: 'rgba(247,147,26,0.15)',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    coinId: '746a4e75aeb3221462f762fc41925735983c6039e89288bbb632a8fb1012e7d0',
    decimals: 18,
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    color: '#627EEA',
    bgColor: 'rgba(98,126,234,0.15)',
  },
  {
    symbol: 'USDU',
    name: 'Unicity USD',
    coinId: 'e210f98956f564bfe67ee94fddd386b5157f660d1957169b391f962093a2da2a',
    decimals: 6,
    logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    color: '#26A17B',
    bgColor: 'rgba(38,161,123,0.15)',
  },
];

export const TOKEN_BY_COIN_ID: Record<string, TokenInfo> = Object.fromEntries(
  SUPPORTED_TOKENS.map((t) => [t.coinId, t])
);

export const TOKEN_BY_SYMBOL: Record<string, TokenInfo> = Object.fromEntries(
  SUPPORTED_TOKENS.map((t) => [t.symbol, t])
);

export function parseTokenAmount(humanAmount: string, decimals: number): bigint {
  if (!humanAmount || humanAmount === '') return 0n;
  const trimmed = humanAmount.trim();
  const dotIndex = trimmed.indexOf('.');
  if (dotIndex === -1) return BigInt(trimmed) * BigInt(10 ** decimals);
  const intPart = trimmed.slice(0, dotIndex) || '0';
  let fracPart = trimmed.slice(dotIndex + 1);
  if (fracPart.length > decimals) fracPart = fracPart.slice(0, decimals);
  else fracPart = fracPart.padEnd(decimals, '0');
  return BigInt(intPart) * BigInt(10 ** decimals) + BigInt(fracPart);
}

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