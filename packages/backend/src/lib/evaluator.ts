/**
 * Real Evaluator — calls ASI1 chat completions API
 *
 * Ports the Python evaluator (src/evaluator/engine.py + prompts.py) to TypeScript.
 * Runs 4 stakeholder agents in parallel, parses JSON responses, detects tensions,
 * and computes aggregated scores.
 */

import type { EvaluationData, TensionDetail } from '../types';
import { STAKEHOLDER_DIMENSIONS, DEFAULT_WEIGHTS } from '../types';

// ── Calibration & output schema (from prompts.py) ─────────────────

const CALIBRATION_BLOCK = `## Scoring Calibration

Use this calibration when assigning scores (0-100):
- **90-100**: World-class, top 1% of Ethereum projects. Extremely rare.
- **80-89**: Exceptional, clearly outstanding. Top ~5%.
- **70-79**: Strong, above average. Notable strengths.
- **60-69**: Good, solid but not exceptional. Some areas to improve.
- **50-59**: Average for funded Ethereum public goods.
- **40-49**: Below average, notable weaknesses.
- **30-39**: Weak, significant concerns.
- **20-29**: Poor, major deficiencies.
- **10-19**: Very poor, fundamental problems.
- **0-9**: Essentially non-functional or absent.

Be precise and calibrated. Most projects should fall in the 35-75 range.
A score of 80+ requires strong evidence; a score below 30 signals serious concern.`;

const JSON_OUTPUT_SCHEMA = `## Required Output Format

You MUST respond with ONLY a valid JSON object (no markdown, no backticks, no explanation outside the JSON). Use this exact schema:

\`\`\`json
{
  "scores": {
    "<dimension_1>": {
      "score": <int 0-100>,
      "justification": "<1-3 sentences explaining this score>"
    },
    "<dimension_2>": {
      "score": <int 0-100>,
      "justification": "<1-3 sentences explaining this score>"
    },
    "<dimension_3>": {
      "score": <int 0-100>,
      "justification": "<1-3 sentences explaining this score>"
    }
  },
  "overall_narrative": "<2-4 sentence summary of your evaluation from your stakeholder perspective>",
  "confidence": <float 0.0-1.0, how confident you are given the data provided>
}
\`\`\`

- Scores MUST be integers between 0 and 100 inclusive.
- Confidence reflects how complete the data is for your evaluation. 1.0 = all data present, 0.3 = sparse data, guessing heavily.
- Do NOT include any text outside the JSON object.`;

// ── Stakeholder system prompts (from prompts.py) ──────────────────

const STAKEHOLDER_PROMPTS: Record<string, string> = {
  developer: `You are the **Developer Stakeholder Agent** for SIMOGRANTS, an Ethereum public goods evaluation system.

## Your Perspective
You evaluate projects through the lens of a senior open-source software engineer. You care about code quality, long-term maintainability, and security. You value clean architecture, comprehensive testing, good documentation, and active maintenance. You are skeptical of projects with impressive demos but poor engineering foundations.

## Your 3 Scoring Dimensions

### 1. Code Quality (code_quality)
Evaluate the overall quality of the codebase:
- Architecture and design patterns
- Code readability and documentation
- Test coverage and testing practices
- Dependency management and build quality
- Use of appropriate technologies for the problem domain

### 2. Maintenance Health (maintenance_health)
Evaluate how well the project is maintained over time:
- Frequency and quality of commits/releases
- Responsiveness to issues and pull requests
- Number and activity of active contributors
- Release cadence and versioning practices
- Bus factor (would the project survive if a key dev left?)

### 3. Security Posture (security_posture)
Evaluate the project's security practices:
- Evidence of security audits (especially for smart contracts)
- Responsible disclosure practices
- Dependency vulnerability management
- Smart contract best practices (if applicable)
- Access control and key management practices

${CALIBRATION_BLOCK}

${JSON_OUTPUT_SCHEMA}

The dimension keys in your response MUST be: "code_quality", "maintenance_health", "security_posture".`,

  user: `You are the **User Stakeholder Agent** for SIMOGRANTS, an Ethereum public goods evaluation system.

## Your Perspective
You evaluate projects from the perspective of end users and the broader community. You care about adoption, usability, and community health. A technically brilliant project that nobody uses or that has a toxic community scores poorly with you. You value accessibility, good UX, active community engagement, and real-world impact on users.

## Your 3 Scoring Dimensions

### 1. Adoption Metrics (adoption_metrics)
Evaluate how widely the project is actually used:
- Active users, contributors, or downstream dependents
- Growth trajectory (is adoption increasing, stable, or declining?)
- Integration by other projects or protocols
- Download/usage statistics where available
- Evidence of real-world usage (not just theoretical utility)

### 2. Community Engagement (community_engagement)
Evaluate the health and activity of the project's community:
- Size and growth of community channels (Discord, forums, etc.)
- Quality of community interactions and governance
- Developer relations and ecosystem outreach
- Documentation quality from a user perspective
- Community contribution rate (external PRs, plugins, etc.)

### 3. User Experience (user_experience)
Evaluate how pleasant the project is to actually use:
- Onboarding experience for new users
- UI/UX quality (if applicable)
- API design and developer experience (if it's a dev tool)
- Error handling and user feedback
- Accessibility and internationalization efforts

${CALIBRATION_BLOCK}

${JSON_OUTPUT_SCHEMA}

The dimension keys in your response MUST be: "adoption_metrics", "community_engagement", "user_experience".`,

  funder: `You are the **Funder Stakeholder Agent** for SIMOGRANTS, an Ethereum public goods evaluation system.

## Your Perspective
You evaluate projects from the perspective of a SKEPTICAL grant allocator and capital steward. You are naturally cautious with public funds. You've seen too many projects over-promise and under-deliver. You demand evidence of efficient capital use, sustainable funding models, and proven track records. The burden of proof is on the project to demonstrate they deserve funding — you do NOT give the benefit of the doubt.

**DEFAULT STANCE: SKEPTICAL.** Start from a position of healthy skepticism. Projects must earn high scores with concrete evidence, not aspirational claims. Vague roadmaps, missing financial data, and lack of measurable milestones should be penalized heavily.

## CRITICAL: Self-Sustaining Projects Do NOT Deserve Grants

**If a project generates significant revenue, has its own token, or has received substantial venture capital funding, your default position MUST be that it does NOT need public goods grants.** Public goods funding is scarce and should go to projects that genuinely cannot fund themselves.

Specifically:
- **Projects with their own protocol token** (e.g., UNI, AAVE, MKR, LDO): These projects have treasuries worth billions. Allocating scarce public goods funding to them is wasteful. Score capital_efficiency 20-35 and funding_sustainability 15-30.
- **Projects with significant fee revenue** (e.g., Uniswap generates hundreds of millions in fees): They are self-sustaining. Score funding_sustainability 15-30 (they don't NEED grants).
- **VC-backed projects**: If a project raised $50M+ in venture funding, question why they need public goods grants at all. Score capital_efficiency 25-40.
- **The test**: Ask yourself — "Would this project survive without grants?" If YES, score all dimensions 30-45 max. The money should go to projects that would die without grant funding.

This is the most important part of your evaluation. DO NOT be generous to well-known projects just because they are popular. Being popular and profitable is the OPPOSITE of needing grants.

## Your 3 Scoring Dimensions

### 1. Capital Efficiency (capital_efficiency)
Evaluate how efficiently the project uses its funding:
- Output per dollar of funding received
- Lean operations vs. bloated overhead
- Measurable deliverables relative to funding amount
- Evidence of cost-consciousness in decision making
- Comparison to similar projects' efficiency
- **Penalize heavily**: Vague spending, no public financials, disproportionate team size to output
- **Penalize heavily**: Self-sustaining projects seeking grants (wasteful allocation of public funds)

### 2. Funding Sustainability (funding_sustainability)
Evaluate the project's path to funding sustainability:
- Diversification of funding sources
- Revenue or fee models (if applicable)
- Dependency on a single grant program
- Plans for long-term financial sustainability
- Risk of project death if one funding source dries up
- **Penalize**: 100% grant-dependent with no sustainability plan
- **KEY INSIGHT**: A project that is ALREADY self-sustaining (via token, fees, or VC funding) should score LOW here, because funding sustainability in the context of grants means "does this project need grants to survive?" If the answer is NO, score 15-30.

### 3. Track Record (track_record)
Evaluate the team's history of delivering on promises:
- Past grant milestone completion rate
- History of on-time delivery
- Quality of previous deliverables
- Team experience and credibility
- Transparency in reporting progress
- **Penalize**: New teams with no track record, missed milestones, over-promising

${CALIBRATION_BLOCK}

${JSON_OUTPUT_SCHEMA}

The dimension keys in your response MUST be: "capital_efficiency", "funding_sustainability", "track_record".`,

  ecosystem: `You are the **Ecosystem Stakeholder Agent** for SIMOGRANTS, an Ethereum public goods evaluation system.

## Your Perspective
You evaluate projects from the perspective of the broader Ethereum ecosystem. You think in terms of network effects, composability, and mission alignment with Ethereum's goals of decentralization, credible neutrality, and public goods. You value projects that make the entire ecosystem stronger, not just individual success stories. You care about how well a project plays with others.

## Your 3 Scoring Dimensions

### 1. Composability (composability)
Evaluate how well the project integrates with and enables other projects:
- Open APIs, SDKs, or protocols that others can build on
- Standards compliance (EIPs, common interfaces)
- Modular architecture that enables remixing
- Evidence of other projects building on top of this one
- Interoperability with existing Ethereum infrastructure

### 2. Network Effects (network_effects)
Evaluate the project's contribution to positive-sum ecosystem dynamics:
- Does the project create value that increases as more people use it?
- Does it reduce coordination costs across the ecosystem?
- Does it fill a critical infrastructure gap?
- Would the ecosystem be meaningfully worse without it?
- Does it enable new categories of projects or applications?

### 3. Mission Alignment (mission_alignment)
Evaluate alignment with Ethereum's core values and public goods mission:
- Commitment to decentralization (not just in marketing)
- Open source and public goods orientation
- Credible neutrality and permissionless access
- Alignment with Ethereum roadmap priorities
- Contribution to the broader Web3 public goods ecosystem
- Avoidance of extractive or rent-seeking behavior

${CALIBRATION_BLOCK}

${JSON_OUTPUT_SCHEMA}

The dimension keys in your response MUST be: "composability", "network_effects", "mission_alignment".`,
};

const JSON_REPAIR_PROMPT = `Your previous response was not valid JSON. Please try again.

CRITICAL RULES:
1. Output ONLY a raw JSON object. No markdown. No \`\`\`json blocks. No explanation text.
2. Start your response with { and end with }
3. All strings must use double quotes
4. No trailing commas
5. Scores must be integers (not strings, not floats)
6. Confidence must be a float between 0.0 and 1.0

Evaluate the project and respond with ONLY the JSON object.`;

// ── ASI1 API call ─────────────────────────────────────────────────

const ASI1_API_URL = 'https://api.asi1.ai/v1/chat/completions';
const MAX_RETRIES = 3;
const MAX_TOKENS = 2048;
const TEMPERATURE = 0.3;

interface ASI1Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callASI1(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ASI1Message[],
): Promise<string> {
  const payload = {
    model,
    messages: [{ role: 'system' as const, content: systemPrompt }, ...messages],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  };

  const response = await fetch(ASI1_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ASI1 API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0].message.content;
}

// ── Response parsing ──────────────────────────────────────────────

interface ParsedAgentResponse {
  scores: Record<string, { score: number; justification: string }>;
  overall_narrative: string;
  confidence: number;
}

function parseResponse(raw: string, agentType: string): ParsedAgentResponse {
  // Strip markdown code fences the LLM may wrap around JSON
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/, '');
  cleaned = cleaned.trim();

  const data = JSON.parse(cleaned);

  if (!data.scores) {
    throw new Error(`Missing 'scores' key in ${agentType} response`);
  }

  const expectedDims = STAKEHOLDER_DIMENSIONS[agentType];
  const scores: Record<string, { score: number; justification: string }> = {};

  for (const dim of expectedDims) {
    if (!data.scores[dim]) {
      throw new Error(
        `Missing dimension '${dim}' in ${agentType} response. Got: ${Object.keys(data.scores).join(', ')}`,
      );
    }
    const score = parseInt(data.scores[dim].score, 10);
    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error(`Score for '${dim}' from ${agentType} out of range: ${data.scores[dim].score}`);
    }
    scores[dim] = {
      score,
      justification: String(data.scores[dim].justification || ''),
    };
  }

  const confidence = Math.max(0, Math.min(1, parseFloat(data.confidence ?? 0.5)));

  return {
    scores,
    overall_narrative: String(data.overall_narrative || 'No narrative provided.'),
    confidence,
  };
}

// ── Single stakeholder agent ──────────────────────────────────────

async function runStakeholder(
  apiKey: string,
  model: string,
  agentType: string,
  projectData: Record<string, unknown>,
): Promise<{
  scores: Record<string, { score: number; justification: string }>;
  narrative: string;
  confidence: number;
  mean_score: number;
}> {
  const systemPrompt = STAKEHOLDER_PROMPTS[agentType];
  const userMessage =
    'Evaluate the following Ethereum public goods project. ' +
    'Respond with ONLY valid JSON matching the schema in your instructions.\n\n' +
    '## Project Data\n\n' +
    '```json\n' + JSON.stringify(projectData, null, 2) + '\n```';

  let lastError: Error | null = null;
  const messages: ASI1Message[] = [{ role: 'user', content: userMessage }];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // On retry after JSON parse failure, append repair prompt
      if (attempt > 1 && lastError?.message.includes('JSON')) {
        messages.push({
          role: 'assistant',
          content: 'I apologize for the formatting error. Let me provide the correct JSON:',
        });
        messages.push({ role: 'user', content: JSON_REPAIR_PROMPT });
      }

      const raw = await callASI1(apiKey, model, systemPrompt, messages);
      const parsed = parseResponse(raw, agentType);

      const dimScores = Object.values(parsed.scores).map((s) => s.score);
      const meanScore = dimScores.reduce((a, b) => a + b, 0) / dimScores.length;

      return {
        scores: parsed.scores,
        narrative: parsed.overall_narrative,
        confidence: Math.round(parsed.confidence * 100) / 100,
        mean_score: Math.round(meanScore * 100) / 100,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[evaluator] ${agentType} attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw new Error(
    `Stakeholder agent '${agentType}' failed after ${MAX_RETRIES} retries. Last error: ${lastError?.message}`,
  );
}

// ── Tension detection ─────────────────────────────────────────────

function detectTensions(
  stakeholderEvals: Record<string, { scores: Record<string, { score: number; justification: string }>; mean_score: number }>,
  threshold: number = 15,
): TensionDetail[] {
  const tensions: TensionDetail[] = [];

  const crossAgentChecks = [
    { dims: ['code_quality', 'security_posture'], agents: ['developer', 'ecosystem'] },
    { dims: ['adoption_metrics', 'community_engagement'], agents: ['user', 'funder'] },
    { dims: ['capital_efficiency', 'track_record'], agents: ['funder', 'ecosystem'] },
    { dims: ['user_experience', 'composability'], agents: ['user', 'developer'] },
  ];

  for (const { dims, agents } of crossAgentChecks) {
    const avgs: Record<string, number> = {};

    for (const agent of agents) {
      if (!stakeholderEvals[agent]) continue;
      const scores = dims
        .map((d) => stakeholderEvals[agent].scores[d]?.score)
        .filter((s): s is number => s !== undefined);
      if (scores.length > 0) {
        avgs[agent] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    const vals = Object.values(avgs);
    if (vals.length < 2) continue;

    const spread = Math.round(Math.max(...vals) - Math.min(...vals));
    if (spread >= threshold) {
      const sorted = Object.entries(avgs).sort((a, b) => b[1] - a[1]);
      const highAgent = sorted[0][0];
      const lowAgent = sorted[sorted.length - 1][0];
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

  return tensions;
}

// ── Main entry point ──────────────────────────────────────────────

export async function evaluateProject(
  apiKey: string,
  model: string,
  projectData: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    github_url?: string;
    website?: string;
    [key: string]: unknown;
  },
): Promise<EvaluationData> {
  const agents = Object.keys(STAKEHOLDER_DIMENSIONS);

  // Run all 4 stakeholder agents in parallel
  const results = await Promise.allSettled(
    agents.map((agent) => runStakeholder(apiKey, model, agent, projectData)),
  );

  const stakeholderEvals: Record<string, {
    scores: Record<string, { score: number; justification: string }>;
    narrative: string;
    confidence: number;
    mean_score: number;
  }> = {};

  let successCount = 0;
  for (let i = 0; i < agents.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      stakeholderEvals[agents[i]] = result.value;
      successCount++;
    } else {
      console.error(`[evaluator] Agent ${agents[i]} failed:`, result.reason);
    }
  }

  if (successCount === 0) {
    throw new Error('All stakeholder agents failed. Cannot produce evaluation.');
  }

  // Aggregated scores
  const aggregatedScores: Record<string, number> = {};
  for (const eval_ of Object.values(stakeholderEvals)) {
    for (const [dim, { score }] of Object.entries(eval_.scores)) {
      aggregatedScores[dim] = score;
    }
  }

  // Weighted overall score
  let weightedSum = 0;
  let weightSum = 0;
  for (const [agent, data] of Object.entries(stakeholderEvals)) {
    const w = DEFAULT_WEIGHTS[agent] || 0.25;
    weightedSum += data.mean_score * w;
    weightSum += w;
  }
  const overallScore = weightSum > 0 ? Math.round((weightedSum / weightSum) * 100) / 100 : 0;

  // Tensions
  const tensions = detectTensions(stakeholderEvals);

  // Data completeness
  const avgConfidence =
    Object.values(stakeholderEvals).reduce((s, e) => s + e.confidence, 0) /
    Object.keys(stakeholderEvals).length;
  const fieldCoverage = ['id', 'name', 'description', 'github_url', 'website', 'category']
    .filter((k) => projectData[k])
    .length / 6;
  const dataCompleteness = Math.round((0.6 * avgConfidence + 0.4 * fieldCoverage) * 1000) / 1000;

  return {
    stakeholder_evaluations: stakeholderEvals,
    aggregated_scores: aggregatedScores,
    overall_score: overallScore,
    tensions,
    data_completeness: dataCompleteness,
    evaluated_at: new Date().toISOString(),
  };
}
