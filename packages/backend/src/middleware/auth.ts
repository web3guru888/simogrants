import { createMiddleware } from 'hono/factory';
import type { Env } from '../types';

/**
 * Extract the authenticated user address from the Authorization header.
 * Looks up session token in KV: `session:{token}` → `{ address, chainId, expiresAt }`
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const sessionKey = `session:${token}`;

  try {
    const sessionData = await c.env.SESSIONS.get(sessionKey, 'json') as {
      address: string;
      chainId: number;
      expiresAt: string;
    } | null;

    if (!sessionData) {
      return c.json({ error: 'Invalid or expired session token' }, 401);
    }

    // Check expiration
    if (new Date(sessionData.expiresAt) < new Date()) {
      await c.env.SESSIONS.delete(sessionKey);
      return c.json({ error: 'Session expired' }, 401);
    }

    // Attach user info to context
    c.set('userAddress', sessionData.address);
    c.set('userChainId', sessionData.chainId);
    await next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return c.json({ error: 'Authentication failed' }, 401);
  }
});

// Extend Hono context variables
declare module 'hono' {
  interface ContextVariableMap {
    userAddress: string;
    userChainId: number;
  }
}
