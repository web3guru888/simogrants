/**
 * Bradley-Terry Ranking
 * Ported from src/evaluator/bradley_terry.py
 *
 * Computes pairwise comparison probabilities and iteratively estimates
 * strength parameters for ranking projects.
 */

/**
 * Generate pairwise comparisons from project scores.
 */
export function generatePairwiseComparisons(
  projectScores: Record<string, number>
): Array<{ winner: string; loser: string; margin: number }> {
  const entries = Object.entries(projectScores);
  const comparisons: Array<{ winner: string; loser: string; margin: number }> = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [idA, scoreA] = entries[i];
      const [idB, scoreB] = entries[j];
      if (scoreA >= scoreB) {
        comparisons.push({ winner: idA, loser: idB, margin: scoreA - scoreB });
      } else {
        comparisons.push({ winner: idB, loser: idA, margin: scoreB - scoreA });
      }
    }
  }
  return comparisons;
}

/**
 * Bradley-Terry MLE estimation.
 * Iteratively updates strength parameters until convergence.
 */
export function bradleyTerryAggregate(
  comparisons: Array<{ winner: string; loser: string; margin: number }>,
  maxIterations: number = 100,
  tolerance: number = 1e-6,
): Record<string, number> {
  const projectIds = new Set<string>();
  for (const c of comparisons) {
    projectIds.add(c.winner);
    projectIds.add(c.loser);
  }

  if (projectIds.size < 2) {
    const result: Record<string, number> = {};
    for (const id of projectIds) result[id] = 1.0;
    return result;
  }

  const strengths: Record<string, number> = {};
  const wins: Record<string, number> = {};
  for (const id of projectIds) {
    strengths[id] = 1.0;
    wins[id] = 0;
  }

  for (const c of comparisons) {
    wins[c.winner] += 1.0 + c.margin / 100.0;
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    const newStrengths: Record<string, number> = {};
    let maxDiff = 0;

    for (const id of projectIds) {
      let denomSum = 0;
      for (const c of comparisons) {
        if (c.winner === id || c.loser === id) {
          const opponent = c.winner === id ? c.loser : c.winner;
          denomSum += 1.0 / (strengths[id] + strengths[opponent]);
        }
      }
      newStrengths[id] = denomSum > 0 ? wins[id] / denomSum : strengths[id];
      maxDiff = Math.max(maxDiff, Math.abs(newStrengths[id] - strengths[id]));
    }

    const total = Object.values(newStrengths).reduce((s, v) => s + v, 0);
    const n = projectIds.size;
    for (const id of projectIds) {
      strengths[id] = (newStrengths[id] / total) * n;
    }

    if (maxDiff < tolerance) break;
  }

  return strengths;
}

/**
 * Compute Bradley-Terry rankings from evaluation scores.
 */
export function computeBradleyTerryRanking(
  evaluationScores: Record<string, number>
): Record<string, number> {
  if (Object.keys(evaluationScores).length < 2) {
    const result: Record<string, number> = {};
    for (const id of Object.keys(evaluationScores)) result[id] = 1.0;
    return result;
  }

  const comparisons = generatePairwiseComparisons(evaluationScores);
  return bradleyTerryAggregate(comparisons);
}
