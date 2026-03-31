import { http, createConfig, createStorage } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { BASE_SEPOLIA, BASE_MAINNET } from './chains';

export const wagmiConfig = createConfig({
  chains: [BASE_SEPOLIA, BASE_MAINNET],
  connectors: [
    injected(),
    walletConnect({
      projectId: import.meta.env.VITE_WC_PROJECT_ID || 'demo-project-id',
    }),
  ],
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
