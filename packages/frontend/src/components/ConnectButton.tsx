import { useEffect, useRef } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';

export function ConnectButton() {
  const { connect, connectors } = useConnect();
  const { isConnected: wagmiConnected, address: wagmiAddress } = useAccount();
  const { isConnected, address, isLoading, signIn, signOut, user } = useAuth();
  const pendingSignIn = useRef(false);

  // Auto-trigger signIn when wallet connects and we don't have a session
  useEffect(() => {
    if (wagmiConnected && wagmiAddress && !user && !isLoading && pendingSignIn.current) {
      pendingSignIn.current = false;
      signIn();
    }
  }, [wagmiConnected, wagmiAddress, user, isLoading, signIn]);

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-mono text-[#8a8a9a]">{truncated}</span>
        </div>
        <button
          onClick={signOut}
          className="px-3 py-1.5 text-sm rounded-lg border border-white/[0.08] text-[#6b6a6a] hover:text-[#e2e0dc] hover:border-white/[0.15] transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        pendingSignIn.current = true;
        const injected = connectors.find(c => c.id === 'injected');
        if (injected) {
          connect({ connector: injected });
        } else if (connectors.length > 0) {
          connect({ connector: connectors[0] });
        }
      }}
      disabled={isLoading}
      className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-[#0a0a12] hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Signing In...
        </span>
      ) : (
        'Connect Wallet'
      )}
    </button>
  );
}
