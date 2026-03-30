import { useConnect } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';

export function ConnectButton() {
  const { connect, connectors } = useConnect();
  const { isConnected, address, isLoading, signIn, signOut, user } = useAuth();

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-mono text-slate-300">{truncated}</span>
        </div>
        <button
          onClick={signOut}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const injected = connectors.find(c => c.id === 'injected');
        if (injected) {
          connect({ connector: injected }, { onSuccess: () => {
            // signIn will be called after connect from the auth flow
            setTimeout(() => signIn(), 500);
          }});
        } else if (connectors.length > 0) {
          connect({ connector: connectors[0] }, { onSuccess: () => {
            setTimeout(() => signIn(), 500);
          }});
        }
      }}
      disabled={isLoading}
      className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Connecting...
        </span>
      ) : (
        'Connect Wallet'
      )}
    </button>
  );
}
