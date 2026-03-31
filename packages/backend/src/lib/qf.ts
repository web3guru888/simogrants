/**
 * Quadratic Funding (QF) Engine
 * Ported from /shared/simogrants/src/mechanism/qf.py
 */

export class QFEngine {
  private capPerProject: number;

  constructor(capPerProject: number = 0.25) {
    this.capPerProject = capPerProject;
  }

  /**
   * Calculate QF allocations from contributions.
   * 
   * For each project: sqrt_sum = sum(sqrt(contribution)) for each contributor
   * QF score = sqrt_sum^2
   * allocation = (score / total_scores) * matching_pool
   */
  calculate(
    contributions: Map<string, number[]>,
    matchingPool: number
  ): Map<string, number> {
    if (contributions.size === 0) return new Map();

    const qfScores = new Map<string, number>();

    for (const [project, contribs] of contributions) {
      const cleaned = contribs
        .filter((c) => c != null)
        .map((c) => Math.max(0.0, Number(c)));
      const sqrtSum = cleaned.reduce((sum, c) => sum + Math.sqrt(c), 0);
      qfScores.set(project, sqrtSum * sqrtSum);
    }

    let total = 0;
    for (const score of qfScores.values()) total += score;

    if (total <= 0) {
      const equal = matchingPool / contributions.size;
      return new Map(
        Array.from(contributions.keys()).map((p) => [p, equal])
      );
    }

    const alloc = new Map<string, number>();
    for (const [project, score] of qfScores) {
      alloc.set(project, (score / total) * matchingPool);
    }

    return this.applyCap(alloc, matchingPool);
  }

  private applyCap(
    allocations: Map<string, number>,
    matchingPool: number
  ): Map<string, number> {
    const cap = matchingPool * this.capPerProject;
    if (allocations.size === 0) return new Map();

    const capped = new Map(allocations);

    for (let i = 0; i < 10; i++) {
      const over: string[] = [];
      for (const [p, v] of capped) {
        if (v > cap) over.push(p);
      }
      if (over.length === 0) return capped;

      let excess = 0;
      for (const p of over) {
        excess += capped.get(p)! - cap;
        capped.set(p, cap);
      }

      const under: string[] = [];
      for (const [p, v] of capped) {
        if (v < cap) under.push(p);
      }

      if (under.length === 0 || excess <= 0) break;

      const underTotal = under.reduce((sum, p) => sum + capped.get(p)!, 0);
      if (underTotal <= 0) {
        const share = excess / under.length;
        for (const p of under) capped.set(p, capped.get(p)! + share);
      } else {
        for (const p of under) {
          capped.set(p, capped.get(p)! + excess * (capped.get(p)! / underTotal));
        }
      }
    }

    return capped;
  }
}
