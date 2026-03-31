/**
 * Stigmergic Quadratic Funding (SQF) Mechanism
 * Ported from /shared/simogrants/src/mechanism/sqf.py
 * 
 * Combines:
 * 1. Quadratic Funding — amplifies breadth of community support
 * 2. PageRank on dependency graph — boosts infra projects that others depend on
 * 3. Pheromone trails — rewards projects with consistent historical accuracy
 */

import { QFEngine } from './qf';
import { PheromoneTracker } from './pheromone';
import { PageRankEngine } from './pagerank';

const DEFAULT_VIRTUAL_CONTRIBUTORS = 10;

/**
 * Convert evaluation scores to QF contribution lists.
 * Each project gets the SAME number of virtual contributors.
 * Contribution SIZE is proportional to score.
 */
export function scoresToContributions(
  evaluationScores: Record<string, number>,
  numContributors: number = DEFAULT_VIRTUAL_CONTRIBUTORS
): Map<string, number[]> {
  const contributions = new Map<string, number[]>();
  for (const [pid, score] of Object.entries(evaluationScores)) {
    const contributionSize = Math.max(0.01, score / 10.0);
    contributions.set(pid, Array(numContributors).fill(contributionSize));
  }
  return contributions;
}

export interface SQFAllocation {
  amount: number;
  qfBase: number;
  pheromoneMod: number;
  pagerankMod: number;
}

export interface SQFResult {
  allocations: Record<string, SQFAllocation>;
  pheromoneState: Record<string, number>;
  totalAllocated: number;
}

export class SQFMechanism {
  private qf: QFEngine;
  private pheromone: PheromoneTracker;
  private pagerank: PageRankEngine;
  private matchingPool: number;

  constructor(
    matchingPool: number = 100000,
    damping: number = 0.85,
    cap: number = 0.25
  ) {
    this.qf = new QFEngine(cap);
    this.pheromone = new PheromoneTracker();
    this.pagerank = new PageRankEngine(damping);
    this.matchingPool = matchingPool;
  }

  /**
   * Compute SQF funding allocation.
   */
  computeAllocation(
    contributions: Map<string, number[]>,
    dependencies: [string, string][],
    evaluationScores?: Record<string, number>
  ): Record<string, number> {
    if (contributions.size === 0) return {};

    // Step 1: Base QF allocation
    const qfAlloc = this.qf.calculate(contributions, this.matchingPool);

    // Step 2: PageRank modifier from dependency graph
    this.pagerank.buildGraph(dependencies);
    const prScores = this.pagerank.computePageRank();

    // Step 3: Apply modifiers
    const sqfAlloc: Record<string, number> = {};
    for (const [project, base] of qfAlloc) {
      const pheromoneMod = this.pheromone.getModifier(project);
      const pagerankMod = this.pagerank.getModifier(project, prScores);
      sqfAlloc[project] = base * pheromoneMod * pagerankMod;
    }

    // Normalize to match the pool
    const total = Object.values(sqfAlloc).reduce((s, v) => s + v, 0);
    if (total <= 0) {
      const equal = this.matchingPool / contributions.size;
      const result: Record<string, number> = {};
      for (const p of contributions.keys()) result[p] = equal;
      return result;
    }

    const normalized: Record<string, number> = {};
    for (const [p, v] of Object.entries(sqfAlloc)) {
      normalized[p] = (v / total) * this.matchingPool;
    }
    return normalized;
  }

  /**
   * Compute allocation directly from evaluation scores (recommended entry point).
   */
  computeAllocationFromScores(
    evaluationScores: Record<string, number>,
    dependencies: [string, string][],
    numContributors: number = DEFAULT_VIRTUAL_CONTRIBUTORS
  ): Record<string, number> {
    const contributions = scoresToContributions(evaluationScores, numContributors);
    return this.computeAllocation(contributions, dependencies, evaluationScores);
  }

  /**
   * Compute allocation with detailed breakdown (for API responses).
   */
  computeAllocationDetailed(
    evaluationScores: Record<string, number>,
    dependencies: [string, string][],
    numContributors: number = DEFAULT_VIRTUAL_CONTRIBUTORS
  ): SQFResult {
    const contributions = scoresToContributions(evaluationScores, numContributors);

    // Get QF base scores
    const qfAlloc = this.qf.calculate(contributions, this.matchingPool);

    // Get PageRank
    this.pagerank.buildGraph(dependencies);
    const prScores = this.pagerank.computePageRank();

    // Compute with modifiers
    const raw: Record<string, { amount: number; qfBase: number; pheromoneMod: number; pagerankMod: number }> = {};
    let total = 0;

    for (const [project, base] of qfAlloc) {
      const pheromoneMod = this.pheromone.getModifier(project);
      const pagerankMod = this.pagerank.getModifier(project, prScores);
      const amount = base * pheromoneMod * pagerankMod;
      raw[project] = { amount, qfBase: base, pheromoneMod, pagerankMod };
      total += amount;
    }

    // Normalize
    const allocations: Record<string, SQFAllocation> = {};
    let totalAllocated = 0;
    if (total > 0) {
      for (const [p, data] of Object.entries(raw)) {
        const normalizedAmount = (data.amount / total) * this.matchingPool;
        allocations[p] = {
          amount: Math.round(normalizedAmount * 100) / 100,
          qfBase: Math.round(data.qfBase * 100) / 100,
          pheromoneMod: Math.round(data.pheromoneMod * 1000) / 1000,
          pagerankMod: Math.round(data.pagerankMod * 1000) / 1000,
        };
        totalAllocated += normalizedAmount;
      }
    }

    return {
      allocations,
      pheromoneState: this.pheromone.getState(),
      totalAllocated: Math.round(totalAllocated * 100) / 100,
    };
  }

  advanceEpoch(accuracyScores: Record<string, number>): void {
    this.pheromone.decayAll();
    for (const [project, accuracy] of Object.entries(accuracyScores)) {
      this.pheromone.deposit(project, accuracy);
    }
  }

  getState(): { matching_pool: number; pheromone_state: Record<string, number>; nodes: string[] } {
    return {
      matching_pool: this.matchingPool,
      pheromone_state: this.pheromone.getState(),
      nodes: Array.from(this.pagerank.computePageRank().keys()),
    };
  }
}
