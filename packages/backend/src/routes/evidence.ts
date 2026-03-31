/**
 * Evidence Routes
 * Upload, list, and download evidence via R2.
 */
import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

export const evidenceRoutes = new Hono<{ Bindings: Env }>();

// --- POST /api/evidence/upload ---
evidenceRoutes.post('/upload', authMiddleware, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const projectId = formData.get('projectId') as string | null;
  const roundId = formData.get('roundId') as string | null;
  const evidenceType = formData.get('evidenceType') as string || 'evaluation';

  if (!file) {
    return c.json({ error: 'No file provided. Use multipart/form-data with "file" field.' }, 400);
  }

  if (!projectId) {
    return c.json({ error: 'Missing projectId field' }, 400);
  }

  // Verify project exists
  const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ?')
    .bind(projectId)
    .first();

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Generate R2 key
  const timestamp = Date.now();
  const r2Key = `evidence/${projectId}/${roundId || 'unassigned'}/${timestamp}-${file.name}`;

  // Upload to R2
  const arrayBuffer = await file.arrayBuffer();
  await c.env.EVIDENCE.put(r2Key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  // Record in D1
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO evidence (project_id, round_id, r2_key, file_name, content_type, file_size, evidence_type, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      projectId,
      roundId || null,
      r2Key,
      file.name || null,
      file.type || null,
      arrayBuffer.byteLength,
      evidenceType,
      now
    )
    .run();

  return c.json({
    key: r2Key,
    size: arrayBuffer.byteLength,
    type: evidenceType,
    uploadedAt: now,
    url: `/api/evidence/${projectId}/${encodeURIComponent(r2Key)}`,
  }, 201);
});

// --- GET /api/evidence/:projectId ---
evidenceRoutes.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM evidence WHERE project_id = ? ORDER BY uploaded_at DESC'
  )
    .bind(projectId)
    .all();

  return c.json({
    evidence: (results || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      key: row.r2_key,
      size: row.file_size,
      type: row.evidence_type,
      roundId: row.round_id,
      uploadedAt: row.uploaded_at,
    })),
    projectId,
  });
});

// --- GET /api/evidence/:projectId/:key ---
evidenceRoutes.get('/:projectId/:key', async (c) => {
  const key = c.req.param('key');
  const projectId = c.req.param('projectId');

  // Verify the evidence belongs to this project
  const record = await c.env.DB.prepare(
    'SELECT * FROM evidence WHERE r2_key = ? AND project_id = ?'
  )
    .bind(decodeURIComponent(key), projectId)
    .first();

  if (!record) {
    return c.json({ error: 'Evidence not found' }, 404);
  }

  // Fetch from R2
  const object = await c.env.EVIDENCE.get(decodeURIComponent(key));
  if (!object) {
    return c.json({ error: 'File not found in storage' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Length', String(object.size));
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});
