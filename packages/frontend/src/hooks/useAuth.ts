import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { api } from '@/lib/api';
import type { UserInfo } from '@/lib/types';

export function useAuth() {
  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check existing session on mount
  const checkSession = useCallback(async () => {
    if (api.getToken()) {
      try {
        const me = await api.getMe();
        setUser(me);
      } catch {
        api.clearToken();
      }
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const signIn = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Get nonce (pass address so backend can build SIWE message)
      const { message } = await api.getNonce(address);

      // 2. Sign message
      const signature = await signMessageAsync({ message });

      // 3. Verify signature
      const { token } = await api.verify(message, signature);
      api.setToken(token);

      // 4. Get user info
      const me = await api.getMe();
      setUser(me);
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed');
      api.clearToken();
    } finally {
      setIsLoading(false);
    }
  }, [address, signMessageAsync]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch { /* ignore */ }
    api.clearToken();
    setUser(null);
    disconnect();
  }, [disconnect]);

  return {
    address,
    isConnected,
    user,
    isLoading,
    error,
    signIn,
    signOut,
    checkSession,
  };
}
