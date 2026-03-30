/**
 * Project Routes
 * CRUD for projects and applications.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

export const projectRoutes = new Hono<{ Bindings: Env }>();

// --- GET /api/projects ---
projectRoutes.get('/', async (c) => {
  const roundId = c.req.query('roundId');
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let query: string;
  const params: unknown[] = [];

  if (roundId) {
    // List projects that applied to a specific round
    query = `SELECT DISTINCT p.*,
             COALESCE(al.total_funding, 0) as total_funding_received
             FROM projects p
             JOIN applications a ON p.id = a.project_id
             LEFT JOIN (
               SELECT application_id, SUM(amount) as total_funding
               FROM allocations GROUP BY application_id
             ) al ON al.application_id = a.id
             WHERE a.round_id = ?`;
    params.push(roundId);

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
  } else {
    query = `SELECT p.*,
             COALESCE(al.total_funding, 0) as total_funding_received
             FROM projects p
             LEFT JOIN (
               SELECT app.project_id, SUM(alloc.amount) as total_funding
               FROM allocations alloc
               JOIN applications app ON alloc.application_id = app.id
               GROUP BY app.project_id
             ) al ON al.project_id = p.id`;
  }

  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  // Get total
  let countQuery = 'SELECT COUNT(*) as total FROM projects';
  const countParams: unknown[] = [];
  if (roundId) {
    countQuery = `SELECT COUNT(DISTINCT p.id) as total FROM projects p
                  JOIN applications a ON p.id = a.project_id WHERE a.round_id = ?`;
    countParams.push(roundId);
    if (status) {
      countQuery += ' AND a.status = ?';
      countParams.push(status);
    }
  }
  const totalRow = await c.env.DB.prepare(countQuery)
    .bind(...countParams)
    .first<{ total: number }>();

  return c.json({
    projects: results,
    total: totalRow?.total || 0,
  });
});

// --- POST /api/projects (auth required) ---
const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().default(''),
  website: z.string().url().optional().or(z.literal('')),
  githubUrl: z.string().optional(),
  teamSize: z.number().int().min(0).optional().default(0),
  category: z.string().optional(),
});

projectRoutes.post('/', authMiddleware, async (c) => {
  let body: z.infer<typeof createProjectSchema>;
  try {
    body = createProjectSchema.parse(await c.req.json());
  } catch (err) {
    return c.json({ error: 'Validation error', details: err }, 400);
  }

  const createdBy = c.get('userAddress');

  // Generate slug-like ID from name
  const id = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || `project-${Date.now()}`;

  const now = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      `INSERT INTO projects (id, name, description, website, github_url, team_size, category, created_by, overall_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    )
      .bind(
        id,
        body.name,
        body.description,
        body.website || null,
        body.githubUrl || null,
        body.teamSize,
        body.category || null,
        createdBy,
        now,
        now
      )
      .run();
  } catch (err: unknown) {
    // Handle duplicate
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE') || msg.includes('duplicate')) {
      return c.json({ error: `Project '${id}' already exists` }, 409);
    }
    return c.json({ error: 'Failed to create project', details: msg }, 500);
  }

  return c.json(
    {
      id,
      name: body.name,
      description: body.description,
      website: body.website || null,
      github_url: body.githubUrl || null,
      team_size: body.teamSize,
      category: body.category || null,
      created_by: createdBy,
      overall_score: null,
      created_at: now,
      updated_at: now,
    },
    201
  );
});

// --- GET /api/projects/:id ---
projectRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?')
    .bind(id)
    .first();

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Get evaluations for this project (via applications)
  const { results: evalRows } = await c.env.DB.prepare(
    `SELECT e.*, a.round_id, r.title as round_title
     FROM evaluations e
     JOIN applications a ON e.application_id = a.id
     JOIN rounds r ON a.round_id = r.id
     WHERE a.project_id = ?
     ORDER BY e.evaluated_at DESC`
  )
    .bind(id)
    .all();

  const evaluations = (evalRows || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    roundId: row.round_id,
    roundTitle: row.round_title,
    evaluationData: typeof row.evaluation_data === 'string'
      ? JSON.parse(row.evaluation_data)
      : row.evaluation_data,
    overallScore: row.overall_score,
    dataCompleteness: row.data_completeness,
    bradleyTerryRank: row.bradley_terry_rank,
    evaluatedAt: row.evaluated_at,
  }));

  // Get allocations for this project
  const { results: allocRows } = await c.env.DB.prepare(
    `SELECT al.*, r.currency, r.title as round_title
     FROM allocations al
     JOIN applications a ON al.application_id = a.id
     JOIN rounds r ON al.round_id = r.id
     WHERE a.project_id = ?
     ORDER BY al.computed_at DESC`
  )
    .bind(id)
    .all();

  const allocations = (allocRows || []).map((row: Record<string, unknown>) => ({
    roundId: row.round_id,
    roundTitle: row.round_title,
    amount: row.amount,
    currency: row.currency,
    sqfDetails: {
      qfBase: row.qf_base,
      pheromoneMod: row.pheromone_modifier,
      pagerankMod: row.pagerank_modifier,
    },
    pheromoneState: typeof row.pheromone_state === 'string'
      ? JSON.parse(row.pheromone_state)
      : row.pheromone_state,
    epoch: row.epoch,
    computedAt: row.computed_at,
  }));

  return c.json({
    project,
    evaluations,
    allocations,
  });
});

// --- POST /api/rounds/:roundId/apply (auth required) ---
const applySchema = z.object({
  projectId: z.string().min(1),
});

// We need to handle this route on the projectRoutes but the path is /api/rounds/:roundId/apply
// So we'll add it as a wildcard route on projects
projectRoutes.post('/rounds/:roundId/apply', authMiddleware, async (c) => {
  const roundId = c.req.param('roundId');
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
