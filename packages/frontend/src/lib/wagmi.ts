import { http, createConfig, createStorage } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { BASE_SEPOLIA, BASE_MAINNET } from './chains';

const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID;

const connectors = wcProjectId
  ? [injected(), walletConnect({ projectId: wcProjectId })]
  : [injected()];

if (!wcProjectId) {
  console.warn('[wagmi] VITE_WC_PROJECT_ID not set — WalletConnect disabled, using injected wallets only.');
}

export const wagmiConfig = createConfig({
  chains: [BASE_SEPOLIA, BASE_MAINNET],
  connectors,
  storage: createStorage({ storage: window.localStorage }),
  transports: {
    [BASE_SEPOLIA.id]: http('https://sepolia.base.org'),
    [BASE_MAINNET.id]: http('https://mainnet.base.org'),
  },
  ssr: false,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
