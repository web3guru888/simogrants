import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import type { Env } from './types';
import { authRoutes } from './routes/auth';
import { roundRoutes } from './routes/rounds';
import { projectRoutes } from './routes/projects';
import { evaluationRoutes } from './routes/evaluations';
import { evidenceRoutes } from './routes/evidence';
import { pipelineRoutes } from './routes/pipeline';
import { statsRoutes } from './routes/stats';

const app = new Hono<{ Bindings: Env }>();

// ── Middleware ──────────────────────────────────────────────────────

// CORS — allow all origins in dev, restrict in production
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
}));

app.use('*', logger());

// Pretty-print JSON in development
app.use('*', prettyJSON());

// Rate-limit hint headers (informational — enforcement would use Cloudflare Rate Limiting)
app.use('*', async (c, next) => {
  await next();
  // Always set rate-limit headers so the frontend can display them
  if (!c.res.headers.get('X-RateLimit-Limit')) {
    c.header('X-RateLimit-Limit', '1000', { append: true });
    c.header('X-RateLimit-Remaining', '999', { append: true });
    c.header('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 3600), { append: true });
  }
});

// Ensure all JSON responses have Content-Type
app.use('*', async (c, next) => {
  await next();
  const ct = c.res.headers.get('Content-Type');
  if (ct && ct.includes('text/plain') && typeof c.res.body === 'object') {
    c.header('Content-Type', 'application/json; charset=utf-8', { append: false });
  }
});

// ── Health Check ───────────────────────────────────────────────────

app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    service: 'simogrants-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
);

// ── Mount Route Groups ────────────────────────────────────────────

app.route('/api/auth', authRoutes);
app.route('/api/rounds', roundRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api', evaluationRoutes);
app.route('/api/evidence', evidenceRoutes);
app.route('/api/pipeline', pipelineRoutes);
app.route('/api/stats', statsRoutes);

// ── 404 Handler ───────────────────────────────────────────────────

app.notFound((c) => {
  return c.json(
    { error: 'Not Found', code: 404, path: c.req.path },
    404
  );
});

// ── Global Error Handler ──────────────────────────────────────────

app.onError((err, c) => {
  console.error('Unhandled error:', err);

  // Zod validation errors
  const msg = err.message || 'Internal Server Error';
  const isClientError = msg.includes('Validation') || msg.includes('Invalid');

  return c.json(
    {
      error: isClientError ? msg : 'Internal Server Error',
      code: isClientError ? 400 : 500,
      details: isClientError ? msg : undefined,
    },
    isClientError ? 400 : 500
  );
});

export default app;
