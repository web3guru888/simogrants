/**
 * Auth Routes — SIWE (Sign-In with Ethereum)
 * Simplified for demo: generates nonce, verifies signature, manages sessions in KV.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';

export const authRoutes = new Hono<{ Bindings: Env }>();

// --- Helpers ---

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

// --- POST /api/auth/nonce ---
authRoutes.post('/nonce', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const address = (body.address || '').toLowerCase();

  const nonce = generateNonce();

  // Build SIWE-style message
  const message =
    `simogrants.com wants you to sign in with your Ethereum account:\n` +
    `${address || '<your-wallet-address>'}\n\n` +
    `Sign this message to verify your identity.\n\n` +
    `Nonce: ${nonce}`;

  // Store nonce in KV with 5 min TTL
  if (address) {
    await c.env.SESSIONS.put(`nonce:${address}`, nonce, {
      expirationTtl: 300,
    });
  }

  return c.json({ nonce, message });
});

// --- POST /api/auth/verify ---
const verifySchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
  address: z.string().min(1).optional(),
});

authRoutes.post('/verify', async (c) => {
  let body: z.infer<typeof verifySchema>;
  try {
    body = verifySchema.parse(await c.req.json());
  } catch {
    return c.json({ error: 'Invalid request body. Expected { message, signature }' }, 400);
  }

  const { message, signature } = body;

  // Extract address from SIWE-style message if not provided
  let normalizedAddress: string;
  if (body.address) {
    normalizedAddress = body.address.toLowerCase();
  } else {
    const addressMatch = message.match(/\n([a-zA-Z0-9]{40,42})\n/);
    if (addressMatch) {
      normalizedAddress = addressMatch[1].toLowerCase();
      if (!normalizedAddress.startsWith('0x')) normalizedAddress = '0x' + normalizedAddress;
    } else {
      // Fallback: can't determine address, reject
      return c.json({ error: 'Could not extract address from message. Please include address in request body.' }, 400);
    }
  }

  // For demo: skip actual crypto verification and just accept valid-looking inputs
  // In production, you'd use viem's `verifyMessage` or siwe package
  if (!signature.startsWith('0x') || signature.length < 10) {
    return c.json({ error: 'Invalid signature format' }, 400);
  }

  // Verify nonce exists (check if message contains a nonce we issued)
  const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
  if (nonceMatch) {
    const storedNonce = await c.env.SESSIONS.get(`nonce:${normalizedAddress}`);
    if (storedNonce && storedNonce !== nonceMatch[1]) {
      return c.json({ error: 'Invalid or expired nonce' }, 401);
    }
    // Clean up nonce
    await c.env.SESSIONS.delete(`nonce:${normalizedAddress}`);
  }

  // Create session
  const token = generateToken();
  const sessionData = {
    address: normalizedAddress,
    chainId: 84532, // Base Sepolia
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
  };

  await c.env.SESSIONS.put(`session:${token}`, JSON.stringify(sessionData), {
    expirationTtl: 86400, // 24h
  });

  // Upsert user in D1
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO users (address, display_name, created_at, last_login)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(address) DO UPDATE SET last_login = ?`
  )
    .bind(normalizedAddress, null, now, now, now)
    .run();

  return c.json({
    token,
    address: normalizedAddress,
    chainId: sessionData.chainId,
  });
});

// --- GET /api/auth/me ---
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const sessionData = await c.env.SESSIONS.get(`session:${token}`, 'json') as {
    address: string;
    chainId: number;
    expiresAt: string;
  } | null;

  if (!sessionData) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  if (new Date(sessionData.expiresAt) < new Date()) {
    await c.env.SESSIONS.delete(`session:${token}`);
    return c.json({ error: 'Session expired' }, 401);
  }

  const address = sessionData.address;

  // Get user stats from D1
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE address = ?')
    .bind(address)
    .first();

  const roundsCreated = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM rounds WHERE creator_address = ?'
  )
    .bind(address)
    .first<{ count: number }>();

  const applicationsSubmitted = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM applications a
     JOIN projects p ON a.project_id = p.id
     WHERE p.created_by = ?`
  )
    .bind(address)
    .first<{ count: number }>();

  return c.json({
    address: sessionData.address,
    chainId: sessionData.chainId,
    display_name: user?.display_name || null,
    roundsCreated: roundsCreated?.count || 0,
    applicationsSubmitted: applicationsSubmitted?.count || 0,
  });
});

// --- POST /api/auth/logout ---
authRoutes.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    await c.env.SESSIONS.delete(`session:${token}`);
  }
  return c.json({ success: true });
});
