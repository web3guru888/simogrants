/**
 * Evaluation Routes
 * Mock evaluation pipeline, SQF allocation, and results.
 */
import { Hono } from 'hono';
import type { Env } from '../types';
import type { EvaluationData } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateMockEvaluation } from '../lib/mockEvaluator';
import { evaluateProject } from '../lib/evaluator';
import { computeSQFWithPheromone } from '../lib/sqfWithPheromone';

const DEFAULT_ASI1_MODEL = 'asi1-mini';

export const evaluationRoutes = new Hono<{ Bindings: Env }>();

// --- GET /api/evaluations (list with optional round_id filter) ---
evaluationRoutes.get('/evaluations', async (c) => {
  const roundId = c.req.query('round_id');

  let query: string;
  const params: unknown[] = [];

  if (roundId) {
    query = `SELECT e.*, a.project_id, a.round_id, r.title as round_title
             FROM evaluations e
             JOIN applications a ON e.application_id = a.id
             JOIN rounds r ON a.round_id = r.id
             WHERE a.round_id = ?
             ORDER BY e.evaluated_at DESC`;
    params.push(roundId);
  } else {
    query = `SELECT e.*, a.project_id, a.round_id, r.title as round_title
             FROM evaluations e
             JOIN applications a ON e.application_id = a.id
             JOIN rounds r ON a.round_id = r.id
             ORDER BY e.evaluated_at DESC
             LIMIT 50`;
  }

  const { results: evalRows } = await c.env.DB.prepare(query).bind(...params).all();

  const evaluations = (evalRows || []).map((row: Record<string, unknown>) => {
    let evalData;
    try {
      evalData = typeof row.evaluation_data === 'string'
        ? JSON.parse(row.evaluation_data)
        : row.evaluation_data;
    } catch {
      evalData = null;
    }

    return {
      id: row.id,
      applicationId: row.application_id,
      projectId: row.project_id,
      roundId: row.round_id,
      roundTitle: row.round_title,
      stakeholderEvaluations: evalData?.stakeholder_evaluations || null,
      aggregatedScores: evalData?.aggregated_scores || null,
      overallScore: row.overall_score,
      tensions: evalData?.tensions || null,
      bradleyTerryRank: row.bradley_terry_rank,
      dataCompleteness: row.data_completeness,
      evaluatedAt: row.evaluated_at,
    };
  });

  return c.json({ evaluations, total: evaluations.length });
});

// --- POST /api/rounds/:roundId/evaluate ---
evaluationRoutes.post('/rounds/:roundId/evaluate', authMiddleware, async (c) => {
  const roundId = c.req.param('roundId');

  // Verify round exists
  const round = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?')
    .bind(roundId)
    .first<{ status: string; matching_pool: number; evaluation_config: string | null }>();

  if (!round) {
    return c.json({ error: 'Round not found' }, 404);
  }

  // Get applications with project data
  const { results: applications } = await c.env.DB.prepare(
    `SELECT a.id as app_id, a.project_id, p.name, p.description, p.category, p.github_url, p.website
     FROM applications a
     JOIN projects p ON a.project_id = p.id
     WHERE a.round_id = ? AND a.status IN ('submitted', 'evaluated')`
  )
    .bind(roundId)
    .all();

  if (!applications || applications.length === 0) {
    return c.json({ error: 'No applications to evaluate' }, 400);
  }

  // Create pipeline run
  const runId = `pipeline-${roundId}-${Date.now()}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO pipeline_runs (run_id, round_id, status, config, started_at)
     VALUES (?, ?, 'running', ?, ?)`
  )
    .bind(
      runId,
      roundId,
      JSON.stringify({
        roundId,
        matchingPool: round.matching_pool,
        projectCount: applications.length,
      }),
      now
    )
    .run();

  // Update round status
  await c.env.DB.prepare("UPDATE rounds SET status = 'evaluating', updated_at = ? WHERE id = ?")
    .bind(now, roundId)
    .run();

  // Run evaluations for each project (real ASI1 or mock fallback)
  const apiKey = c.env.ASI1_API_KEY;
  const model = c.env.ASI1_MODEL || DEFAULT_ASI1_MODEL;
  const useRealEvaluator = !!apiKey;

  const evaluationScores: Record<string, number> = {};
  let completed = 0;
  let failed = 0;

  // Phase 1: Run all evaluations in parallel
  const evalResults = await Promise.allSettled(
    (applications as Array<Record<string, unknown>>).map(async (app) => {
      let evaluationData: EvaluationData;
      if (useRealEvaluator) {
        evaluationData = await evaluateProject(apiKey, model, {
          id: app.project_id as string,
          name: app.name as string,
          description: (app.description as string) || '',
          category: (app.category as string) || '',
          github_url: (app.github_url as string) || undefined,
          website: (app.website as string) || undefined,
        });
      } else {
        evaluationData = generateMockEvaluation({
          id: app.project_id as string,
          name: app.name as string,
          description: app.description as string,
          category: app.category as string,
        });
      }
      return { app, evaluationData };
    })
  );

  // Phase 2: Process results and write to DB sequentially
  for (const result of evalResults) {
    if (result.status === 'fulfilled') {
      const { app, evaluationData } = result.value;
      try {
        evaluationScores[app.project_id as string] = evaluationData.overall_score;

        // Delete old evaluation if exists, then insert
        await c.env.DB.prepare(
          `DELETE FROM evaluations WHERE application_id = ?`
        )
          .bind(app.app_id)
          .run();

        await c.env.DB.prepare(
          `INSERT INTO evaluations (application_id, evaluation_data, overall_score, data_completeness, bradley_terry_rank, evaluated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(
            app.app_id,
            JSON.stringify(evaluationData),
            evaluationData.overall_score,
            evaluationData.data_completeness,
            completed + 1,
            evaluationData.evaluated_at
          )
          .run();

        // Update application status
        await c.env.DB.prepare(
          "UPDATE applications SET status = 'evaluated', evaluated_at = ? WHERE id = ?"
        )
          .bind(evaluationData.evaluated_at, app.app_id)
          .run();

        // Update project overall score
        await c.env.DB.prepare(
          'UPDATE projects SET overall_score = ?, updated_at = ? WHERE id = ?'
        )
          .bind(evaluationData.overall_score, now, app.project_id)
          .run();

        completed++;
      } catch (err) {
        console.error(`DB write failed for ${app.project_id}:`, err);
        failed++;
      }
    } else {
      console.error('Evaluation failed:', result.reason);
      failed++;
    }
  }

  // Compute SQF allocation with persistent pheromone state
  let allocations: { allocations: Record<string, { amount: number }>; pheromoneState: Record<string, number> } | null = null;
  if (completed > 0 && Object.keys(evaluationScores).length > 0) {
    try {
      // Build dependency edges
      const projectIds = Object.keys(evaluationScores);
      const dependencies: [string, string][] = [];
      for (let i = 1; i < projectIds.length; i++) {
        dependencies.push([projectIds[i], projectIds[0]]);
      }

      // Compute SQF with pheromone persistence (loads previous state, advances epoch)
      const sqfResult = await computeSQFWithPheromone(
        c.env.DB,
        round.matching_pool,
        evaluationScores,
        dependencies,
      );

      // Store allocations
      for (const [projectId, alloc] of Object.entries(sqfResult.allocations)) {
        const appEntry = (applications as Array<Record<string, unknown>>).find(
          (a) => a.project_id === projectId
        );
        if (appEntry) {
          await c.env.DB.prepare(
            `INSERT INTO allocations (round_id, application_id, amount, qf_base, pheromone_modifier, pagerank_modifier, pheromone_state, epoch, computed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              roundId,
              appEntry.app_id,
              alloc.amount,
              alloc.qfBase,
              alloc.pheromoneMod,
              alloc.pagerankMod,
              JSON.stringify(sqfResult.pheromoneState),
              sqfResult.epoch,
              now
            )
            .run();
        }
      }

      allocations = sqfResult;
    } catch (err) {
      console.error('SQF allocation failed:', err);
    }
  }

  // Attestation phase: compute hashes + optional IPFS upload
  let attestationData: { evaluationHash: string; ipfsCid: string | null } | null = null;
  if (allocations && completed > 0) {
    try {
      const { computeAttestation, storeAttestation } = await import('../lib/attestation');
      const { buildEvidenceBundle, uploadToIPFS } = await import('../lib/ipfs');

      // Build evidence bundle
      const evidence = buildEvidenceBundle(
        roundId,
        evaluationScores,
        allocations.allocations as Record<string, { amount: number; qfBase: number; pheromoneMod: number; pagerankMod: number }>,
        allocations.pheromoneState,
        1,
      );

      // Upload to IPFS if token available
      let ipfsCid: string | null = null;
      const web3Token = c.env.WEB3_STORAGE_TOKEN;
      if (web3Token) {
        const ipfsResult = await uploadToIPFS(web3Token, evidence, `evidence-${roundId}.json`);
        if (ipfsResult) ipfsCid = ipfsResult.cid;
      }

      // Compute attestation hashes
      const attestation = await computeAttestation(roundId, evaluationScores, allocations.allocations, ipfsCid);
      await storeAttestation(c.env.DB, runId, attestation);
      attestationData = { evaluationHash: attestation.evaluationHash, ipfsCid };
    } catch (err) {
      console.error('Attestation failed:', err);
    }
  }

  // Complete pipeline
  const completedAt = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE pipeline_runs SET status = 'complete', results = ?, completed_at = ? WHERE run_id = ?`
  )
    .bind(
      JSON.stringify({
        projectsEvaluated: completed,
        projectsFailed: failed,
        totalAllocated: allocations
          ? Object.values(allocations.allocations).reduce(
              (sum, a) => sum + a.amount,
              0
            )
          : 0,
        attestation: attestationData,
      }),
      completedAt,
      runId
    )
    .run();

  // Update round status
  await c.env.DB.prepare("UPDATE rounds SET status = 'funded', updated_at = ? WHERE id = ?")
    .bind(completedAt, roundId)
    .run();

  return c.json({
    pipelineRunId: runId,
    status: 'complete',
    projectCount: completed,
    failed,
    results: allocations,
    estimatedTime: 'completed',
  });
});

// --- GET /api/pipeline/:runId ---
evaluationRoutes.get('/pipeline/:runId', async (c) => {
  const runId = c.req.param('runId');

  const pipeline = await c.env.DB.prepare(
    'SELECT * FROM pipeline_runs WHERE run_id = ?'
  )
    .bind(runId)
    .first<{
      run_id: string;
      round_id: string;
      status: string;
      config: string | null;
      results: string | null;
      error: string | null;
      started_at: string;
      completed_at: string | null;
    }>();

  if (!pipeline) {
    return c.json({ error: 'Pipeline run not found', code: 404 }, 404);
  }

  // Get progress
  const config = pipeline.config ? JSON.parse(pipeline.config) : {};
  const results = pipeline.results ? JSON.parse(pipeline.results) : {};

  return c.json({
    runId: pipeline.run_id,
    roundId: pipeline.round_id,
    status: pipeline.status,
    progress: {
      total: config.projectCount || results.projectsEvaluated || 0,
      completed: results.projectsEvaluated || 0,
      failed: results.projectsFailed || 0,
    },
    results: results,
    startedAt: pipeline.started_at,
    completedAt: pipeline.completed_at,
  });
});

// --- POST /api/rounds/:roundId/allocate ---
evaluationRoutes.post('/rounds/:roundId/allocate', authMiddleware, async (c) => {
  const roundId = c.req.param('roundId');

  const round = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?')
    .bind(roundId)
    .first<{ matching_pool: number }>();

  if (!round) {
    return c.json({ error: 'Round not found' }, 404);
  }

  // Get evaluated applications with scores
  const { results: evaluations } = await c.env.DB.prepare(
    `SELECT e.application_id, e.overall_score, a.project_id
     FROM evaluations e
     JOIN applications a ON e.application_id = a.id
     WHERE a.round_id = ?`
  )
    .bind(roundId)
    .all();

  if (!evaluations || evaluations.length === 0) {
    return c.json({ error: 'No evaluated applications for this round' }, 400);
  }

  const evaluationScores: Record<string, number> = {};
  const projectIds: string[] = [];

  for (const ev of evaluations as Array<Record<string, unknown>>) {
    evaluationScores[ev.project_id as string] = ev.overall_score as number;
    projectIds.push(ev.project_id as string);
  }

  // Build dependency graph
  const dependencies: [string, string][] = [];
  for (let i = 1; i < projectIds.length; i++) {
    dependencies.push([projectIds[i], projectIds[0]]);
  }

  const result = await computeSQFWithPheromone(c.env.DB, round.matching_pool, evaluationScores, dependencies);

  // Store allocations in D1
  const now = new Date().toISOString();
  for (const [projectId, alloc] of Object.entries(result.allocations)) {
    const appEntry = (evaluations as Array<Record<string, unknown>>).find(
      (e) => e.project_id === projectId
    );
    if (appEntry) {
      await c.env.DB.prepare(
        `INSERT INTO allocations (round_id, application_id, amount, qf_base, pheromone_modifier, pagerank_modifier, pheromone_state, epoch, computed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          roundId,
          appEntry.application_id,
          alloc.amount,
          alloc.qfBase,
          alloc.pheromoneMod,
          alloc.pagerankMod,
          JSON.stringify(result.pheromoneState),
          result.epoch,
          now
        )
        .run();
    }
  }

  return c.json({
    roundId,
    epoch: result.epoch,
    matchingPool: round.matching_pool,
    allocations: result.allocations,
    pheromoneState: result.pheromoneState,
    totalAllocated: result.totalAllocated,
  });
});

// --- GET /api/rounds/:roundId/results ---
evaluationRoutes.get('/rounds/:roundId/results', async (c) => {
  const roundId = c.req.param('roundId');

  const round = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?')
    .bind(roundId)
    .first();

  if (!round) {
    return c.json({ error: 'Round not found' }, 404);
  }

  // Get ranked results with project info
  const { results: rows } = await c.env.DB.prepare(
    `SELECT
       p.id as project_id,
       p.name as project_name,
       p.description as project_description,
       p.category,
       p.overall_score as project_score,
       e.overall_score as eval_score,
       e.evaluation_data,
       e.data_completeness,
       e.bradley_terry_rank,
       al.amount as allocation,
       al.qf_base,
       al.pheromone_modifier,
       al.pagerank_modifier,
       al.pheromone_state
     FROM applications a
     JOIN projects p ON a.project_id = p.id
     LEFT JOIN evaluations e ON e.id = (
       SELECT id FROM evaluations WHERE application_id = a.id ORDER BY evaluated_at DESC LIMIT 1
     )
     LEFT JOIN allocations al ON al.id = (
       SELECT id FROM allocations WHERE application_id = a.id ORDER BY computed_at DESC LIMIT 1
     )
     WHERE a.round_id = ?
     ORDER BY al.amount DESC NULLS LAST, e.overall_score DESC NULLS LAST`
  )
    .bind(roundId)
    .all();

  const results = (rows || []).map((row: Record<string, unknown>, index: number) => ({
    rank: index + 1,
    project: {
      id: row.project_id,
      name: row.project_name,
      description: row.project_description,
      category: row.category,
      overallScore: row.eval_score || row.project_score,
    },
    score: row.eval_score || row.project_score,
    allocation: row.allocation || 0,
    sqfDetails: row.allocation
      ? {
          qfBase: row.qf_base,
          pheromoneMod: row.pheromone_modifier,
          pagerankMod: row.pagerank_modifier,
        }
      : null,
  }));

  // Summary
  const totalAllocated = results.reduce((sum: number, r: Record<string, unknown>) => sum + (r.allocation as number || 0), 0);
  const scoredProjects = results.filter((r: Record<string, unknown>) => r.score != null);
  const averageScore = scoredProjects.length > 0
    ? Math.round(
        scoredProjects.reduce((sum: number, r: Record<string, unknown>) => sum + (r.score as number), 0) /
        scoredProjects.length * 10
      ) / 10
    : null;

  return c.json({
    round,
    results,
    summary: {
      totalPool: (round as Record<string, unknown>).matching_pool,
      totalAllocated,
      projectsFunded: results.filter((r: Record<string, unknown>) => (r.allocation as number) > 0).length,
      averageScore,
    },
  });
});

// --- GET /api/projects/:projectId/evaluations ---
evaluationRoutes.get('/projects/:projectId/evaluations', async (c) => {
  const projectId = c.req.param('projectId');

  const { results: evalRows } = await c.env.DB.prepare(
    `SELECT e.*, a.round_id, r.title as round_title, r.status as round_status
     FROM evaluations e
     JOIN applications a ON e.application_id = a.id
     JOIN rounds r ON a.round_id = r.id
     WHERE a.project_id = ?
     ORDER BY e.evaluated_at DESC`
  )
    .bind(projectId)
    .all();

  if (!evalRows || evalRows.length === 0) {
    return c.json({ evaluations: [], projectId });
  }

  const evaluations = evalRows.map((row: Record<string, unknown>) => ({
    id: row.id,
    roundId: row.round_id,
    roundTitle: row.round_title,
    roundStatus: row.round_status,
    stakeholderEvaluations: (typeof row.evaluation_data === 'string'
      ? JSON.parse(row.evaluation_data)
      : row.evaluation_data
    )?.stakeholder_evaluations,
    aggregatedScores: (typeof row.evaluation_data === 'string'
      ? JSON.parse(row.evaluation_data)
      : row.evaluation_data
    )?.aggregated_scores,
    overallScore: row.overall_score,
    tensions: (typeof row.evaluation_data === 'string'
      ? JSON.parse(row.evaluation_data)
      : row.evaluation_data
    )?.tensions,
    bradleyTerryRank: row.bradley_terry_rank,
    dataCompleteness: row.data_completeness,
    evaluatedAt: row.evaluated_at,
  }));

  return c.json({ evaluations, projectId });
});
