/**
 * Grant Rounds Routes
 * CRUD for grant rounds with D1 persistence.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

export const roundRoutes = new Hono<{ Bindings: Env }>();

// --- GET /api/rounds ---
roundRoutes.get('/', async (c) => {
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let query = 'SELECT r.*, (SELECT COUNT(*) FROM applications a WHERE a.round_id = r.id) as applications_count FROM rounds r';
  const params: unknown[] = [];

  if (status) {
    query += ' WHERE r.status = ?';
    params.push(status);
  }

  query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM rounds';
  const countParams: unknown[] = [];
  if (status) {
    countQuery += ' WHERE status = ?';
    countParams.push(status);
  }
  const totalRow = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();

  return c.json({
    rounds: results,
    total: totalRow?.total || 0,
    limit,
    offset,
  });
});

// --- POST /api/rounds (auth required) ---
const createRoundSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().default(''),
  matchingPool: z.number().min(0).default(100000),
  currency: z.string().optional().default('USDC'),
  chain: z.string().optional().default('base'),
  applicationDeadline: z.string().optional(),
  maxApplications: z.number().optional().default(100),
  evaluationConfig: z.record(z.unknown()).optional(),
  contractAddress: z.string().optional(),
});

roundRoutes.post('/', authMiddleware, async (c) => {
  let body: z.infer<typeof createRoundSchema>;
  try {
    body = createRoundSchema.parse(await c.req.json());
  } catch (err) {
    return c.json({ error: 'Validation error', details: err }, 400);
  }

  const creatorAddress = c.get('userAddress');
  const id = `round-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const contractAddress = body.contractAddress || null;

  const result = await c.env.DB.prepare(
    `INSERT INTO rounds (id, title, description, creator_address, status, matching_pool, currency, chain, application_deadline, max_applications, evaluation_config, contract_address, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.title,
      body.description,
      creatorAddress,
      body.matchingPool,
      body.currency,
      body.chain,
      body.applicationDeadline || null,
      body.maxApplications,
      body.evaluationConfig ? JSON.stringify(body.evaluationConfig) : null,
      contractAddress,
      now,
      now
    )
    .run();

  return c.json(
    {
      id,
      title: body.title,
      description: body.description,
      creator_address: creatorAddress,
      status: 'active',
      matching_pool: body.matchingPool,
      currency: body.currency,
      chain: body.chain,
      application_deadline: body.applicationDeadline || null,
      max_applications: body.maxApplications,
      evaluation_config: body.evaluationConfig || null,
      contract_address: contractAddress,
      created_at: now,
      updated_at: now,
    },
    201
  );
});

// --- GET /api/rounds/:id ---
roundRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const round = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?')
    .bind(id)
    .first();

  if (!round) {
    return c.json({ error: 'Round not found' }, 404);
  }

  // Get applications with project info
  const { results: applications } = await c.env.DB.prepare(
    `SELECT a.*, p.name as project_name, p.overall_score as project_score
     FROM applications a
     JOIN projects p ON a.project_id = p.id
     WHERE a.round_id = ?
     ORDER BY a.applied_at DESC`
  )
    .bind(id)
    .all();

  // Get statistics
  const stats = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM applications WHERE round_id = ?) as total_applications,
       (SELECT COALESCE(SUM(e.overall_score), 0) FROM evaluations e
        JOIN applications a2 ON e.application_id = a2.id
        WHERE a2.round_id = ?) as total_score,
       (SELECT AVG(e.overall_score) FROM evaluations e
        JOIN applications a2 ON e.application_id = a2.id
        WHERE a2.round_id = ?) as average_score,
       (SELECT COALESCE(SUM(al.amount), 0) FROM allocations al
        WHERE al.round_id = ?) as total_allocated`
  )
    .bind(id, id, id, id)
    .first<{
      total_applications: number;
      total_score: number;
      average_score: number;
      total_allocated: number;
    }>();

  return c.json({
    round,
    applications: applications || [],
    statistics: {
      totalApplications: stats?.total_applications || 0,
      totalMatchingPool: round.matching_pool,
      allocated: stats?.total_allocated || 0,
      averageScore: stats?.average_score ? Math.round(stats.average_score * 10) / 10 : null,
    },
  });
});

// --- PATCH /api/rounds/:id (creator only) ---
const updateRoundSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  matchingPool: z.number().min(0).optional(),
  applicationDeadline: z.string().optional(),
  maxApplications: z.number().optional(),
  evaluationConfig: z.record(z.unknown()).optional(),
});

roundRoutes.patch('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const creatorAddress = c.get('userAddress');

  let body: z.infer<typeof updateRoundSchema>;
  try {
    body = updateRoundSchema.parse(await c.req.json());
  } catch (err) {
    return c.json({ error: 'Validation error', details: err }, 400);
  }

  // Verify creator
  const round = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?')
    .bind(id)
    .first<{ creator_address: string }>();

  if (!round) {
    return c.json({ error: 'Round not found' }, 404);
  }

  if (round.creator_address.toLowerCase() !== creatorAddress.toLowerCase()) {
    return c.json({ error: 'Only the round creator can update this round' }, 403);
  }

  // Build dynamic update
  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.title !== undefined) { updates.push('title = ?'); params.push(body.title); }
  if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
  if (body.matchingPool !== undefined) { updates.push('matching_pool = ?'); params.push(body.matchingPool); }
  if (body.applicationDeadline !== undefined) { updates.push('application_deadline = ?'); params.push(body.applicationDeadline); }
  if (body.maxApplications !== undefined) { updates.push('max_applications = ?'); params.push(body.maxApplications); }
  if (body.evaluationConfig !== undefined) { updates.push('evaluation_config = ?'); params.push(JSON.stringify(body.evaluationConfig)); }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id);

  await c.env.DB.prepare(
    `UPDATE rounds SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...params)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?')
    .bind(id)
    .first();

  return c.json({ round: updated });
});

// --- POST /api/rounds/:id/apply (auth required) ---
const applySchema = z.object({
  projectId: z.string().min(1),
});

roundRoutes.post('/:id/apply', authMiddleware, async (c) => {
  const roundId = c.req.param('id');
  const userAddress = c.get('userAddress');

  let body: z.infer<typeof applySchema>;
  try {
    body = applySchema.parse(await c.req.json());
  } catch {
    return c.json({ error: 'Validation error. Expected { projectId }' }, 400);
  }

  // Verify round exists and is accepting
  const round = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?')
    .bind(roundId)
    .first<{ status: string; application_deadline: string | null; max_applications: number | null }>();

  if (!round) {
    return c.json({ error: 'Round not found' }, 404);
  }

  if (round.status !== 'active' && round.status !== 'accepting') {
    return c.json({ error: `Round is ${round.status}, not accepting applications` }, 409);
  }

  // Verify project exists and belongs to user
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?')
    .bind(body.projectId)
    .first<{ created_by: string }>();

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.created_by.toLowerCase() !== userAddress.toLowerCase()) {
    return c.json({ error: 'Only the project creator can apply' }, 403);
  }

  // Check for duplicate application
  const existing = await c.env.DB.prepare(
    'SELECT id FROM applications WHERE round_id = ? AND project_id = ?'
  )
    .bind(roundId, body.projectId)
    .first();

  if (existing) {
    return c.json({ error: 'Project already applied to this round' }, 409);
  }

  // Check application limit
  const appCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM applications WHERE round_id = ?'
  )
    .bind(roundId)
    .first<{ count: number }>();

  if (appCount && round.max_applications && appCount.count >= round.max_applications) {
    return c.json({ error: 'Round has reached maximum applications' }, 409);
  }

  // Create application
  const appId = `app-${body.projectId.slice(0, 12)}-${roundId.slice(0, 12)}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO applications (id, round_id, project_id, status, applied_at)
     VALUES (?, ?, ?, 'submitted', ?)`
  )
    .bind(appId, roundId, body.projectId, now)
    .run();

  return c.json(
    {
      applicationId: appId,
      roundId,
      projectId: body.projectId,
      status: 'submitted',
      appliedAt: now,
    },
    201
  );
});

// --- POST /api/rounds/:id/close ---
roundRoutes.post('/:id/close', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const creatorAddress = c.get('userAddress');

  const round = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?')
    .bind(id)
    .first<{ creator_address: string; status: string }>();

  if (!round) {
    return c.json({ error: 'Round not found' }, 404);
  }

  if (round.creator_address.toLowerCase() !== creatorAddress.toLowerCase()) {
    return c.json({ error: 'Only the round creator can close this round' }, 403);
  }

  if (round.status === 'closed' || round.status === 'funded') {
    return c.json({ error: 'Round is already closed or funded' }, 409);
  }

  // Update round status
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE rounds SET status = 'closed', updated_at = ? WHERE id = ?`
  )
    .bind(now, id)
    .run();

  // Create pipeline run
  const runId = `pipeline-${id}-${Date.now()}`;
  await c.env.DB.prepare(
    `INSERT INTO pipeline_runs (run_id, round_id, status, config, started_at)
     VALUES (?, ?, 'pending', ?, ?)`
  )
    .bind(runId, id, JSON.stringify({ roundId: id }), now)
    .run();

  return c.json({
    message: 'Round closed successfully',
    pipelineRunId: runId,
    roundId: id,
  });
});
