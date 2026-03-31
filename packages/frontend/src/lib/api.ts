import type {
  Round, Project, RoundDetail, ProjectDetail, RoundResults,
  UserInfo, PipelineStatus,
} from './types';
import { mockApi } from './mockApi';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787/api';

function getToken(): string | null {
  return localStorage.getItem('simogrants_token');
}

// Convert camelCase keys to snake_case recursively (for API requests)
function toSnakeCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    result[snakeKey] = toSnakeCase(value);
  }
  return result;
}

// Convert snake_case keys to camelCase recursively (for API responses)
function toCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = toCamelCase(value);
  }
  return result;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (USE_MOCK) {
    // Route to mock API
    return mockFetch(path, options) as Promise<T>;
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Convert request body from camelCase to snake_case
  let processedOptions = options;
  if (options?.body && typeof options.body === 'string') {
    try {
      const parsed = JSON.parse(options.body);
      const snakeCased = toSnakeCase(parsed);
      processedOptions = { ...options, body: JSON.stringify(snakeCased) };
    } catch { /* not JSON, leave as-is */ }
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...processedOptions, headers });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API Error ${res.status}: ${body || res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return toCamelCase(json) as T;
}

// Route mock API calls
async function mockFetch(path: string, options?: RequestInit) {
  const method = options?.method || 'GET';
  let body: any = undefined;
  if (options?.body) {
    try { body = JSON.parse(options.body as string); } catch { /* ignore */ }
  }

  // Auth
  if (path === '/auth/nonce' && method === 'POST') return mockApi.getNonce();
  if (path === '/auth/verify' && method === 'POST') return mockApi.verifySignature(body.message, body.signature);
  if (path === '/auth/me') return mockApi.getMe();
  if (path === '/auth/logout' && method === 'POST') return mockApi.logout();

  // Rounds
  if (path === '/rounds' && method === 'GET') return mockApi.getRounds();
  if (path === '/rounds' && method === 'POST') return mockApi.createRound(body);
  if (path.match(/^\/rounds\/[\w-]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    return mockApi.getRound(id);
  }
  if (path.match(/^\/rounds\/[\w-]+\/evaluate$/) && method === 'POST') {
    const id = path.split('/')[2];
    return mockApi.triggerEvaluation(id);
  }
  if (path.match(/^\/rounds\/[\w-]+\/results$/) && method === 'GET') {
    const id = path.split('/')[2];
    return mockApi.getRoundResults(id);
  }
  if (path.match(/^\/rounds\/[\w-]+\/apply$/) && method === 'POST') {
    const id = path.split('/')[2];
    return mockApi.applyToRound(id, body.projectId);
  }

  // Projects
  if (path === '/projects' && method === 'GET') return mockApi.getProjects();
  if (path === '/projects' && method === 'POST') return mockApi.createProject(body);
  if (path.match(/^\/projects\/[\w-]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    return mockApi.getProject(id);
  }

  // Pipeline
  if (path.match(/^\/pipeline\/[\w-]+$/)) {
    const id = path.split('/')[2];
    return mockApi.getPipelineStatus(id);
  }

  throw new Error(`Unknown mock endpoint: ${method} ${path}`);
}

// --- Public API ---

export const api = {
  // Auth
  getNonce: () => apiFetch<{ nonce: string; message: string }>('/auth/nonce', { method: 'POST' }),
  verify: (message: string, signature: string) =>
    apiFetch<{ token: string; address: string; chainId: number }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature }),
    }),
  getMe: () => apiFetch<UserInfo>('/auth/me'),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),

  // Rounds
  getRounds: (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : '';
    return apiFetch<{ rounds: Round[]; total: number }>(`/rounds${qs}`);
  },
  getRound: (id: string) => apiFetch<RoundDetail>(`/rounds/${id}`),
  createRound: (data: Partial<Round>) =>
    apiFetch<Round>('/rounds', { method: 'POST', body: JSON.stringify(data) }),
  triggerEvaluation: (roundId: string) =>
    apiFetch<PipelineStatus>(`/rounds/${roundId}/evaluate`, { method: 'POST' }),

  // Results
  getRoundResults: (roundId: string) => apiFetch<RoundResults>(`/rounds/${roundId}/results`),

  // Projects
  getProjects: () => apiFetch<{ projects: Project[]; total: number }>('/projects'),
  getProject: async (id: string): Promise<ProjectDetail> => {
    const raw = await apiFetch<any>(`/projects/${id}`);
    // Transform API evaluation format to frontend format
    const evaluations = (raw.evaluations || []).map((ev: any) => {
      const evalData = ev.evaluationData || {};
      const stakeholderScores = evalData.stakeholderScores || {};

      // Build stakeholderEvaluations from flat scores
      const stakeholderEvaluations: Record<string, any> = {};
      for (const [agent, score] of Object.entries(stakeholderScores)) {
        stakeholderEvaluations[agent] = {
          scores: { overall: score },
          narrative: evalData.summary || '',
          confidence: ev.dataCompleteness || 0.8,
        };
      }

      // Build tensions from API format
      const tensions = (evalData.tensions || []).map((t: any) => ({
        dimension: t.type || t.dimension || 'unknown',
        agents: { high: t.score || 0, low: 0 },
        spread: t.score || 0,
        high_agent: 'unknown',
        low_agent: 'unknown',
        narrative: `Tension type: ${t.type || 'unknown'} (score: ${t.score || 0})`,
      }));

      // Build aggregatedScores from stakeholder averages
      const aggregatedScores: Record<string, number> = {};
      for (const [agent, score] of Object.entries(stakeholderScores)) {
        aggregatedScores[agent] = score as number;
      }

      return {
        id: ev.id,
        roundId: ev.roundId,
        stakeholderEvaluations,
        aggregatedScores,
        overallScore: ev.overallScore || 0,
        bradleyTerryRank: ev.bradleyTerryRank,
        tensions,
        evaluatedAt: ev.evaluatedAt,
      };
    });

    // Transform allocations
    const allocations = (raw.allocations || []).map((a: any) => ({
      roundId: a.roundId,
      amount: a.amount || 0,
      currency: a.currency || 'USDC',
      sqfDetails: a.sqfDetails || { qfBase: 0, pheromoneMod: 1, pagerankMod: 1 },
    }));

    return {
      project: raw.project,
      evaluations,
      allocations,
    };
  },
  createProject: (data: Partial<Project>) =>
    apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  // Apply
  applyToRound: (roundId: string, projectId: string) =>
    apiFetch<{ applicationId: string; roundId: string; projectId: string; status: string; appliedAt: string }>(
      `/rounds/${roundId}/apply`,
      { method: 'POST', body: JSON.stringify({ projectId }) },
    ),

  // Pipeline
  getPipelineStatus: (runId: string) => apiFetch<PipelineStatus>(`/pipeline/${runId}`),

  // Token management
  setToken: (token: string) => localStorage.setItem('simogrants_token', token),
  clearToken: () => localStorage.removeItem('simogrants_token'),
  getToken,
};
