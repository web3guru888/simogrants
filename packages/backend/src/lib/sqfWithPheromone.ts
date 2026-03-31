/**
 * SQF computation with persistent pheromone state.
 *
 * Loads pheromone levels from the most recent allocation in D1,
 * computes SQF with those levels, advances the epoch based on
 * evaluation accuracy, and returns the updated state for storage.
 */

import { SQFMechanism } from './sqf';
import type { SQFResult } from './sqf';

/**
 * Load the latest pheromone state from D1.
 * Looks at the most recent allocation row that has pheromone_state.
 */
export async function loadPheromoneState(db: D1Database): Promise<Record<string, number>> {
  const row = await db.prepare(
    `SELECT pheromone_state FROM allocations
     WHERE pheromone_state IS NOT NULL AND pheromone_state != '{}'
     ORDER BY computed_at DESC LIMIT 1`
  ).first<{ pheromone_state: string }>();

  if (row?.pheromone_state) {
    try {
      return JSON.parse(row.pheromone_state);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Compute the current epoch number based on how many completed rounds exist.
 */
export async function getCurrentEpoch(db: D1Database): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(*) as count FROM rounds WHERE status = 'funded'`
  ).first<{ count: number }>();
  return (row?.count || 0) + 1;
}

/**
 * Convert evaluation scores to accuracy values (0-1 range) for pheromone deposits.
 * Higher scores = higher accuracy = more pheromone deposited.
 */
function scoresToAccuracy(evaluationScores: Record<string, number>): Record<string, number> {
  const accuracy: Record<string, number> = {};
  for (const [pid, score] of Object.entries(evaluationScores)) {
    // Normalize 0-100 score to 0-1 accuracy
    accuracy[pid] = Math.max(0, Math.min(1, score / 100));
  }
  return accuracy;
}

/**
 * Full SQF computation with pheromone persistence.
 *
 * 1. Loads previous pheromone state from DB
 * 2. Creates SQF mechanism with loaded state
 * 3. Computes allocation (QF × pheromone × PageRank)
 * 4. Advances epoch: decays all pheromones 20%, deposits based on score accuracy
 * 5. Returns result with updated pheromone state for storage
 */
export async function computeSQFWithPheromone(
  db: D1Database,
  matchingPool: number,
  evaluationScores: Record<string, number>,
  dependencies: [string, string][],
): Promise<SQFResult & { epoch: number }> {
  // Load previous pheromone state
  const previousState = await loadPheromoneState(db);
  const epoch = await getCurrentEpoch(db);

  // Create mechanism and load state
  const sqf = new SQFMechanism(matchingPool);

  // Load pheromone state if we have history
  if (Object.keys(previousState).length > 0) {
    sqf.loadPheromoneState(previousState);
  }

  // Compute allocation with current pheromone levels
  const result = sqf.computeAllocationDetailed(evaluationScores, dependencies);

  // Advance epoch: decay existing pheromones + deposit based on current scores
  const accuracy = scoresToAccuracy(evaluationScores);
  sqf.advanceEpoch(accuracy);

  // Get updated pheromone state (after decay + deposit)
  const updatedState = sqf.getState();

  return {
    ...result,
    pheromoneState: updatedState.pheromone_state,
    epoch,
  };
}
