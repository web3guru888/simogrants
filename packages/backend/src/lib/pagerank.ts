/**
 * Simplified PageRank Engine
 * Ported from /shared/simogrants/src/mechanism/pagerank.py
 * 
 * Computes PageRank on a dependency graph to boost infrastructure projects
 * that others depend on.
 */

export class PageRankEngine {
  private damping: number;
  private graph: Map<string, Set<string>> = new Map(); // node -> outgoing edges
  private reverseGraph: Map<string, Set<string>> = new Map(); // node -> incoming edges
  private nodes: Set<string> = new Set();

  constructor(damping: number = 0.85) {
    this.damping = damping;
  }

  buildGraph(edges: [string, string][]): void {
    this.graph = new Map();
    this.reverseGraph = new Map();
    this.nodes = new Set();

    for (const [source, target] of edges) {
      this.nodes.add(source);
      this.nodes.add(target);

      if (!this.graph.has(source)) this.graph.set(source, new Set());
      this.graph.get(source)!.add(target);

      if (!this.reverseGraph.has(target)) this.reverseGraph.set(target, new Set());
      this.reverseGraph.get(target)!.add(source);
    }

    // Ensure all nodes exist in graph even if they have no outgoing edges
    for (const node of this.nodes) {
      if (!this.graph.has(node)) this.graph.set(node, new Set());
      if (!this.reverseGraph.has(node)) this.reverseGraph.set(node, new Set());
    }
  }

  computePageRank(iterations: number = 20, tolerance: number = 1e-6): Map<string, number> {
    if (this.nodes.size === 0) return new Map();
    if (this.nodes.size === 1) {
      const only = Array.from(this.nodes)[0];
      return new Map([[only, 1.0]]);
    }

    const n = this.nodes.size;
    const initialScore = 1.0 / n;

    // Initialize scores
    let scores = new Map<string, number>();
    for (const node of this.nodes) scores.set(node, initialScore);

    for (let iter = 0; iter < iterations; iter++) {
      const newScores = new Map<string, number>();
      let totalDiff = 0;

      for (const node of this.nodes) {
        // Sum of PageRank from nodes that point to this node
        let incomingSum = 0;
        const incoming = this.reverseGraph.get(node)!;
        for (const source of incoming) {
          const outDegree = this.graph.get(source)!.size;
          if (outDegree > 0) {
            incomingSum += scores.get(source)! / outDegree;
          }
        }

        // PageRank formula with damping
        const newScore =
          (1 - this.damping) / n + this.damping * incomingSum;
        newScores.set(node, newScore);

        totalDiff += Math.abs(newScore - scores.get(node)!);
      }

      scores = newScores;

      // Normalize to sum to 1
      let totalScore = 0;
      for (const s of scores.values()) totalScore += s;
      if (totalScore > 0) {
        for (const [node, s] of scores) {
          scores.set(node, s / totalScore);
        }
      }

      if (totalDiff < tolerance) break;
    }

    return scores;
  }

  getModifier(projectId: string, prScores: Map<string, number>): number {
    const score = prScores.get(projectId) ?? 0;
    // Scale PageRank to a modifier: baseline 1.0, with range [0.8, 1.3]
    // Average PageRank is 1/n, so we compare relative to average
    const n = prScores.size || 1;
    const avg = 1 / n;
    const ratio = score / avg;
    return 0.8 + 0.5 * Math.min(ratio, 2.0) / 2.0;
  }
}
