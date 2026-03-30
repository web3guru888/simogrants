/**
 * Stats Routes
 * Admin dashboard statistics endpoint.
 */
import { Hono } from 'hono';
import type { Env } from '../types';

export const statsRoutes = new Hono<{ Bindings: Env }>();

// --- GET /api/stats ---
statsRoutes.get('/', async (c) => {
  const [
    roundsRow,
    projectsRow,
    applicationsRow,
    poolRow,
    avgScoreRow,
    evalRow,
    fundedRow,
    recentEvals,
  ] = await Promise.all([
    // Total rounds
    c.env.DB.prepare('SELECT COUNT(*) as count FROM rounds').first<{ count: number }>(),

    // Total projects
    c.env.DB.prepare('SELECT COUNT(*) as count FROM projects').first<{ count: number }>(),

    // Total applications
    c.env.DB.prepare('SELECT COUNT(*) as count FROM applications').first<{ count: number }>(),

    // Total matching pool
    c.env.DB.prepare('SELECT COALESCE(SUM(matching_pool), 0) as total FROM rounds')
      .first<{ total: number }>(),

    // Average evaluation score
    c.env.DB.prepare('SELECT AVG(overall_score) as avg_score FROM evaluations')
      .first<{ avg_score: number | null }>(),

    // Total evaluations
    c.env.DB.prepare('SELECT COUNT(*) as count FROM evaluations').first<{ count: number }>(),

    // Total allocated
    c.env.DB.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM allocations')
      .first<{ total: number }>(),

    // Recent evaluations (last 5)
    c.env.DB.prepare(
      `SELECT e.id, e.overall_score, e.data_completeness, e.evaluated_at,
              p.name as project_name, p.id as project_id,
              r.title as round_title, r.id as round_id
       FROM evaluations e
       JOIN applications a ON e.application_id = a.id
       JOIN projects p ON a.project_id = p.id
       JOIN rounds r ON a.round_id = r.id
       ORDER BY e.evaluated_at DESC
       LIMIT 5`
    ).all(),
  ]);

  // Rounds by status
  const roundStatuses = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM rounds GROUP BY status`
  ).all();

  const statusCounts: Record<string, number> = {};
  if (roundStatuses.results) {
    for (const row of roundStatuses.results as Array<Record<string, unknown>>) {
      statusCounts[row.status as string] = row.count as number;
    }
  }

  return c.json({
    overview: {
      totalRounds: roundsRow?.count || 0,
      totalProjects: projectsRow?.count || 0,
      totalApplications: applicationsRow?.count || 0,
      totalMatchingPool: poolRow?.total || 0,
      totalAllocated: fundedRow?.total || 0,
      averageScore: avgScoreRow?.avg_score
        ? Math.round(avgScoreRow.avg_score * 10) / 10
        : null,
      totalEvaluations: evalRow?.count || 0,
    },
    roundsByStatus: statusCounts,
    recentActivity: {
      recentEvaluations: (recentEvals.results || []).map(
        (row: Record<string, unknown>) => ({
          id: row.id,
          overallScore: row.overall_score,
          dataCompleteness: row.data_completeness,
          evaluatedAt: row.evaluated_at,
          projectName: row.project_name,
          projectId: row.project_id,
          roundTitle: row.round_title,
          roundId: row.round_id,
        })
      ),
    },
  });
});
