export const BASE_SEPOLIA = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan Sepolia', url: 'https://sepolia.basescan.org' },
  },
} as const;

export const chains = [BASE_SEPOLIA] as const;
