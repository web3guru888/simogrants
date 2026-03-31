/**
 * Pipeline Routes
 * Full evaluation pipeline orchestration: evaluate → allocate → store.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import type { EvaluationData } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateMockEvaluation } from '../lib/mockEvaluator';
import { evaluateProject } from '../lib/evaluator';
import { SQFMechanism } from '../lib/sqf';

const DEFAULT_ASI1_MODEL = 'asi1-mini';

export const pipelineRoutes = new Hono<{ Bindings: Env }>();

// --- POST /api/pipeline/run ---
const pipelineRunSchema = z.object({
  roundId: z.string().min(1),
  skipEvaluation: z.boolean().optional().default(false),
  recalculateAllocation: z.boolean().optional().default(true),
});

pipelineRoutes.post('/run', authMiddleware, async (c) => {
  let body: z.infer<typeof pipelineRunSchema>;
  try {
    body = pipelineRunSchema.parse(await c.req.json());
  } catch (err) {
    return c.json({ error: 'Validation error', code: 400, details: err }, 400);
  }

  const { roundId, skipEvaluation, recalculateAllocation } = body;
  const now = new Date().toISOString();

  // Step 1: Verify round exists
  const round = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?')
    .bind(roundId)
    .first<{
      status: string;
      matching_pool: number;
      evaluation_config: string | null;
      title: string;
      currency: string;
    }>();

  if (!round) {
    return c.json({ error: 'Round not found', code: 404 }, 404);
  }

  // Create pipeline run record
  const runId = `pipeline-${roundId}-${Date.now()}`;

  await c.env.DB.prepare(
    `INSERT INTO pipeline_runs (run_id, round_id, status, config, started_at)
     VALUES (?, ?, 'collecting', ?, ?)`
  )
    .bind(
      runId,
      roundId,
      JSON.stringify({
        roundId,
        matchingPool: round.matching_pool,
        skipEvaluation,
        recalculateAllocation,
      }),
      now
    )
    .run();

  // Step 2: Fetch all applications for the round
  const { results: applications } = await c.env.DB.prepare(
    `SELECT a.id as app_id, a.project_id, a.status as app_status,
            p.name, p.description, p.category, p.github_url, p.website, p.overall_score
     FROM applications a
     JOIN projects p ON a.project_id = p.id
     WHERE a.round_id = ?`
  )
    .bind(roundId)
    .all();

  if (!applications || applications.length === 0) {
    await c.env.DB.prepare(
      `UPDATE pipeline_runs SET status = 'failed', error = ?, completed_at = ? WHERE run_id = ?`
    )
      .bind('No applications found for this round', now, runId)
      .run();

    return c.json({ error: 'No applications found for this round', code: 400, runId }, 400);
  }

  // Update pipeline status: evaluating
  await c.env.DB.prepare(
    `UPDATE pipeline_runs SET status = 'evaluating' WHERE run_id = ?`
  )
    .bind(runId)
    .run();

  await c.env.DB.prepare(
    `UPDATE rounds SET status = 'evaluating', updated_at = ? WHERE id = ?`
  )
    .bind(now, roundId)
    .run();

  // Step 3: Run evaluation on each project (real ASI1 or mock fallback)
  const apiKey = c.env.ASI1_API_KEY;
  const model = c.env.ASI1_MODEL || DEFAULT_ASI1_MODEL;
  const useRealEvaluator = !!apiKey;

  const evaluationScores: Record<string, number> = {};
  let completed = 0;
  let failed = 0;

  if (!skipEvaluation) {
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
            `UPDATE applications SET status = 'evaluated', evaluated_at = ? WHERE id = ?`
          )
            .bind(evaluationData.evaluated_at, app.app_id)
            .run();

          // Update project overall score
          await c.env.DB.prepare(
            `UPDATE projects SET overall_score = ?, updated_at = ? WHERE id = ?`
          )
            .bind(evaluationData.overall_score, now, app.project_id)
            .run();

          completed++;
        } catch (err) {
          console.error(`Pipeline DB write failed for ${app.project_id}:`, err);
          failed++;
        }
      } else {
        console.error('Pipeline evaluation failed:', result.reason);
        failed++;
      }
    }
  } else {
    // Load existing evaluation scores
    for (const app of applications as Array<Record<string, unknown>>) {
      const evalRow = await c.env.DB.prepare(
        `SELECT overall_score FROM evaluations WHERE application_id = ?`
      )
        .bind(app.app_id)
        .first<{ overall_score: number }>();

      if (evalRow?.overall_score != null) {
        evaluationScores[app.project_id as string] = evalRow.overall_score;
        completed++;
      }
    }
  }

  // Step 4: Update pipeline status: allocating
  await c.env.DB.prepare(
    `UPDATE pipeline_runs SET status = 'allocating' WHERE run_id = ?`
  )
    .bind(runId)
    .run();

  // Step 5: Compute SQF allocation
  let allocations: Record<string, { amount: number; qfBase: number; pheromoneMod: number; pagerankMod: number }> | null = null;
  let totalAllocated = 0;
  let pheromoneState: Record<string, number> = {};

  if (recalculateAllocation && completed > 0 && Object.keys(evaluationScores).length > 0) {
    try {
      // Delete existing allocations for this round to avoid duplicates
      await c.env.DB.prepare(`DELETE FROM allocations WHERE round_id = ?`)
        .bind(roundId)
        .run();

      const sqf = new SQFMechanism(round.matching_pool);

      // Build dependency graph based on project relationships
      const projectIds = Object.keys(evaluationScores);
      const dependencies: [string, string][] = [];

      // Infrastructure pattern: first project is "base layer",
      // later ones depend on it
      for (let i = 1; i < projectIds.length; i++) {
        dependencies.push([projectIds[i], projectIds[0]]);
      }

      const sqfResult = sqf.computeAllocationDetailed(evaluationScores, dependencies);

      // Store allocations in D1
      for (const [projectId, alloc] of Object.entries(sqfResult.allocations)) {
        const appEntry = (applications as Array<Record<string, unknown>>).find(
          (a) => a.project_id === projectId
        );
        if (appEntry) {
          await c.env.DB.prepare(
            `INSERT INTO allocations (round_id, application_id, amount, qf_base, pheromone_modifier, pagerank_modifier, pheromone_state, epoch, computed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
          )
            .bind(
              roundId,
              appEntry.app_id,
              alloc.amount,
              alloc.qfBase,
              alloc.pheromoneMod,
              alloc.pagerankMod,
              JSON.stringify(sqfResult.pheromoneState),
              now
            )
            .run();
        }
      }

      allocations = sqfResult.allocations;
      pheromoneState = sqfResult.pheromoneState;
      totalAllocated = sqfResult.totalAllocated;
    } catch (err) {
      console.error('Pipeline SQF allocation failed:', err);
      failed++;
    }
  } else if (!recalculateAllocation) {
    // Load existing allocations
    const { results: allocRows } = await c.env.DB.prepare(
      `SELECT al.*, a.project_id FROM allocations al
       JOIN applications a ON al.application_id = a.id
       WHERE al.round_id = ?`
    )
      .bind(roundId)
      .all();

    if (allocRows && allocRows.length > 0) {
      allocations = {};
      for (const row of allocRows as Array<Record<string, unknown>>) {
        allocations[row.project_id as string] = {
          amount: row.amount as number,
          qfBase: row.qf_base as number,
          pheromoneMod: row.pheromone_modifier as number,
          pagerankMod: row.pagerank_modifier as number,
        };
        totalAllocated += row.amount as number;
      }
    }
  }

  // Step 6: Complete pipeline — update round to funded
  const completedAt = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE rounds SET status = 'funded', updated_at = ? WHERE id = ?`
  )
    .bind(completedAt, roundId)
    .run();

  // Update funded applications
  if (allocations) {
    for (const projectId of Object.keys(allocations)) {
      const appEntry = (applications as Array<Record<string, unknown>>).find(
        (a) => a.project_id === projectId
      );
      if (appEntry) {
        await c.env.DB.prepare(
          `UPDATE applications SET status = 'funded' WHERE id = ? AND round_id = ?`
        )
          .bind(appEntry.app_id, roundId)
          .run();
      }
    }
  }

  // Finalize pipeline run
  await c.env.DB.prepare(
    `UPDATE pipeline_runs SET status = 'complete', results = ?, completed_at = ? WHERE run_id = ?`
  )
    .bind(
      JSON.stringify({
        projectsEvaluated: completed,
        projectsFailed: failed,
        totalAllocated,
        pheromoneState,
      }),
      completedAt,
      runId
    )
    .run();

  return c.json({
    runId,
    status: 'complete',
    roundId,
    roundTitle: round.title,
    progress: {
      total: applications.length,
      completed,
      failed,
    },
    results: {
      totalAllocated,
      currency: round.currency,
      allocationCount: allocations ? Object.keys(allocations).length : 0,
      pheromoneState,
    },
    startedAt: now,
    completedAt,
  });
});
