/**
 * Mock Evaluator for Demo
 * Returns realistic-looking evaluation data without calling an LLM.
 * 
 * Structure matches /shared/simogrants/src/evaluator/engine.py output
 */

import type { EvaluationData, TensionDetail } from '../types';
import { STAKEHOLDER_DIMENSIONS, DEFAULT_WEIGHTS } from '../types';

// Base score ranges per project category (for realistic variation)
const CATEGORY_SCORE_BASES: Record<string, Record<string, number>> = {
  'developer-tooling': { code_quality: 88, maintenance_health: 82, security_posture: 85, adoption_metrics: 85, community_engagement: 78, user_experience: 72, capital_efficiency: 75, funding_sustainability: 78, track_record: 85, composability: 90, network_effects: 85, mission_alignment: 82 },
  defi: { code_quality: 85, maintenance_health: 80, security_posture: 82, adoption_metrics: 90, community_engagement: 75, user_experience: 70, capital_efficiency: 85, funding_sustainability: 80, track_record: 88, composability: 82, network_effects: 90, mission_alignment: 75 },
  identity: { code_quality: 80, maintenance_health: 75, security_posture: 82, adoption_metrics: 78, community_engagement: 85, user_experience: 72, capital_efficiency: 70, funding_sustainability: 75, track_record: 78, composability: 82, network_effects: 78, mission_alignment: 88 },
  governance: { code_quality: 75, maintenance_health: 72, security_posture: 78, adoption_metrics: 70, community_engagement: 82, user_experience: 68, capital_efficiency: 80, funding_sustainability: 70, track_record: 72, composability: 72, network_effects: 70, mission_alignment: 90 },
  education: { code_quality: 70, maintenance_health: 68, security_posture: 72, adoption_metrics: 75, community_engagement: 80, user_experience: 78, capital_efficiency: 72, funding_sustainability: 65, track_record: 70, composability: 65, network_effects: 72, mission_alignment: 85 },
};

// Narratives per stakeholder type
const NARRATIVES: Record<string, string[]> = {
  developer: [
    'The codebase demonstrates strong engineering practices with comprehensive test coverage and clear architecture patterns.',
    'Solid technical foundation with room for improvement in documentation and developer onboarding.',
    'Well-structured code with good separation of concerns, though some areas could benefit from refactoring.',
  ],
  user: [
    'The project has demonstrated strong adoption metrics and an active community of engaged users.',
    'Growing user base with positive feedback loops, though retention could be improved.',
    'Community engagement is strong with regular contributions and responsive maintainers.',
  ],
  funder: [
    'The project shows efficient use of funds with clear impact metrics and responsible financial management.',
    'Capital efficiency is good but the project needs a clearer path to sustainability.',
    'Track record demonstrates consistent delivery and growing impact within the ecosystem.',
  ],
  ecosystem: [
    'The project provides critical infrastructure that enhances the composability of the broader ecosystem.',
    'Strong network effects with growing integration points across the ecosystem.',
    'Mission alignment is clear and the project plays a vital role in advancing the ecosystem goals.',
  ],
};

function randomVariation(base: number, range: number = 12): number {
  return Math.max(40, Math.min(100, base + (Math.random() - 0.5) * range));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMockEvaluation(
  projectData: {
    id: string;
    name: string;
    description?: string;
    category?: string;
  },
  seed?: number
): EvaluationData {
  // Use a simple seed for deterministic-ish results
  const seedVal = seed || hashCode(projectData.id);
  const pseudoRandom = createSeededRandom(seedVal);

  const category = projectData.category || 'developer-tooling';
  const baseScores = CATEGORY_SCORE_BASES[category] || CATEGORY_SCORE_BASES['developer-tooling'];

  // Generate stakeholder evaluations
  const stakeholderEvals: Record<string, {
    scores: Record<string, { score: number; justification: string }>;
    narrative: string;
    confidence: number;
    mean_score: number;
  }> = {};

  const aggregatedScores: Record<string, number> = {};

  for (const [agent, dimensions] of Object.entries(STAKEHOLDER_DIMENSIONS) as [string, string[]][]) {
    const scores: Record<string, { score: number; justification: string }> = {};
    let dimTotal = 0;

    for (const dim of dimensions) {
      const base = baseScores[dim] || 75;
      const score = Math.round(randomVariation(base, 10 + pseudoRandom() * 8));
      scores[dim] = {
        score,
        justification: `Score of ${score}/100 based on analysis of ${dim.replace(/_/g, ' ')} metrics and benchmarks.`,
      };
      dimTotal += score;
      aggregatedScores[dim] = score;
    }

    const meanScore = Math.round((dimTotal / dimensions.length) * 100) / 100;
    const confidence = 0.7 + pseudoRandom() * 0.25;

    stakeholderEvals[agent] = {
      scores,
      narrative: pickRandom(NARRATIVES[agent]),
      confidence: Math.round(confidence * 100) / 100,
      mean_score: meanScore,
    };
  }

  // Compute overall score (weighted average of stakeholder means)
  let weightedSum = 0;
  let weightSum = 0;
  for (const [agent, data] of Object.entries(stakeholderEvals)) {
    const w = DEFAULT_WEIGHTS[agent] || 0.25;
    weightedSum += data.mean_score * w;
    weightSum += w;
  }
  const overallScore = weightSum > 0 ? Math.round((weightedSum / weightSum) * 100) / 100 : 0;

  // Detect tensions (spread > threshold between agents on shared dimensions)
  const tensions: TensionDetail[] = [];
  const threshold = 15;

  // Check cross-agent tensions on common metrics
  const crossAgentDimensions = [
    { dims: ['code_quality', 'security_posture'], agents: ['developer', 'ecosystem'] },
    { dims: ['adoption_metrics', 'community_engagement'], agents: ['user', 'funder'] },
    { dims: ['capital_efficiency', 'track_record'], agents: ['funder', 'ecosystem'] },
    { dims: ['user_experience', 'composability'], agents: ['user', 'developer'] },
  ];

  for (const { dims, agents } of crossAgentDimensions) {
    const scoresByAgent: Record<string, number[]> = {};
    for (const agent of agents) {
      if (stakeholderEvals[agent]) {
        scoresByAgent[agent] = dims.map((d) => stakeholderEvals[agent].scores[d]?.score || 75);
      }
    }

    if (agents.length >= 2) {
      const avgs: Record<string, number> = {};
      for (const [agent, scores] of Object.entries(scoresByAgent)) {
        avgs[agent] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }

      const vals = Object.values(avgs);
      const spread = Math.round(Math.max(...vals) - Math.min(...vals));

      if (spread >= threshold) {
        const highAgent = Object.entries(avgs).sort((a, b) => b[1] - a[1])[0][0];
        const lowAgent = Object.entries(avgs).sort((a, b) => a[1] - b[1])[0][0];
        tensions.push({
          dimension: dims.join(' / '),
          agents: Object.fromEntries(Object.entries(avgs).map(([k, v]) => [k, Math.round(v)])),
          spread,
          high_agent: highAgent,
          low_agent: lowAgent,
          narrative: `Notable disagreement of ${spread} points between ${highAgent} (${Math.round(avgs[highAgent])}) and ${lowAgent} (${Math.round(avgs[lowAgent])}) perspectives on ${dims.join(' and ')}.`,
        });
      }
    }
  }

  // Data completeness (blend of confidence and coverage)
  const avgConfidence = Object.values(stakeholderEvals)
    .reduce((s, e) => s + e.confidence, 0) / Object.keys(stakeholderEvals).length;
  const dataCompleteness = Math.round(
    (0.6 * avgConfidence + 0.4 * 0.8) * 1000
  ) / 1000;

  return {
    stakeholder_evaluations: stakeholderEvals,
    aggregated_scores: aggregatedScores,
    overall_score: overallScore,
    tensions,
    data_completeness: dataCompleteness,
    evaluated_at: new Date().toISOString(),
  };
}

// Simple hash function
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Simple seeded pseudo-random number generator (mulberry32)
function createSeededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
