import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { ProjectDetail as ProjectDetailType, StakeholderScores, Tension } from '@/lib/types';
import { ScoreBar } from '@/components/ScoreBar';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorMessage } from '@/components/ErrorMessage';

const STAKEHOLDER_META: Record<string, { label: string; color: string; icon: string }> = {
  developer: { label: 'Developer', color: 'from-violet-500 to-violet-400', icon: '👨‍💻' },
  user: { label: 'User', color: 'from-blue-500 to-blue-400', icon: '👤' },
  funder: { label: 'Funder', color: 'from-emerald-500 to-emerald-400', icon: '💰' },
  ecosystem: { label: 'Ecosystem', color: 'from-cyan-500 to-cyan-400', icon: '🌐' },
};

function StakeholderCard({ name, evaluation }: { name: string; evaluation: StakeholderScores }) {
  const meta = STAKEHOLDER_META[name] || { label: name, color: 'from-slate-500 to-slate-400', icon: '❓' };
  const avgScore = Object.values(evaluation.scores).reduce((sum, s) => sum + s.score, 0) / Object.values(evaluation.scores).length;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <h4 className="font-semibold text-slate-200">{meta.label}</h4>
        </div>
        <span className="text-sm font-bold text-slate-300">{avgScore.toFixed(1)}</span>
      </div>

      <div className="space-y-3">
        {Object.entries(evaluation.scores).map(([dimension, data]) => (
          <ScoreBar
            key={dimension}
            score={data.score}
            label={dimension.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            size="sm"
          />
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700/30">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Confidence</span>
          <span className="text-xs font-medium text-slate-300">{(evaluation.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-1.5">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${meta.color}`}
            style={{ width: `${evaluation.confidence * 100}%` }}
          />
        </div>
      </div>

      {evaluation.narrative && (
        <p className="mt-3 text-xs text-slate-400 leading-relaxed line-clamp-3">{evaluation.narrative}</p>
      )}
    </div>
  );
}

function TensionCard({ tension }: { tension: Tension }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <h4 className="font-semibold text-amber-300 capitalize">{tension.dimension} Tension</h4>
        <span className="ml-auto text-xs font-medium text-amber-400">Spread: {tension.spread}</span>
      </div>
      <div className="flex items-center gap-4 mb-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">↑ {STAKEHOLDER_META[tension.high_agent]?.label || tension.high_agent}</span>
          <span className="text-slate-500">{tension.agents[tension.high_agent]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400">↓ {STAKEHOLDER_META[tension.low_agent]?.label || tension.low_agent}</span>
          <span className="text-slate-500">{tension.agents[tension.low_agent]}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{tension.narrative}</p>
    </div>
  );
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProjectDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const projectData = await api.getProject(id);
        setData(projectData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [id]);

  if (loading) return <LoadingSkeleton type="page" />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const { project, evaluations, allocations } = data;
  const latestEval = evaluations[0];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-b from-violet-950/30 to-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/rounds"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-violet-300 transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Rounds
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{project.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 capitalize border border-slate-600/50">
                  {project.category.replace(/-/g, ' ')}
                </span>
              </div>
              <p className="text-slate-400 max-w-2xl mb-4">{project.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                {project.website && (
                  <a href={project.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                    🌐 Website
                  </a>
                )}
                {project.githubUrl && (
                  <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                    📂 GitHub
                  </a>
                )}
                <span>👥 {project.teamSize} team members</span>
              </div>
            </div>

            {project.overallScore && (
              <div className="text-center shrink-0">
                <div className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  {project.overallScore.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Overall Score</div>
                <ScoreBar score={project.overallScore} size="lg" color="violet" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stakeholder Evaluations */}
        {latestEval && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-6">Stakeholder Evaluations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(latestEval.stakeholderEvaluations).map(([name, evaluation]) => (
                <StakeholderCard key={name} name={name} evaluation={evaluation} />
              ))}
            </div>
          </section>
        )}

        {/* Aggregated Scores */}
        {latestEval && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-6">Aggregated Scores</h2>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
              <div className="space-y-4">
                {Object.entries(latestEval.aggregatedScores).map(([dimension, score]) => (
                  <ScoreBar
                    key={dimension}
                    score={score}
                    label={dimension.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    size="lg"
                    color={score >= 85 ? 'emerald' : score >= 70 ? 'blue' : 'amber'}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tension Analysis */}
        {latestEval && latestEval.tensions.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-6">Tension Analysis</h2>
            <div className="space-y-4">
              {latestEval.tensions.map((tension, i) => (
                <TensionCard key={i} tension={tension} />
              ))}
            </div>
          </section>
        )}

        {/* Allocation History */}
        {allocations.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-6">Allocation History</h2>
            <div className="space-y-3">
              {allocations.map((alloc, i) => (
                <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-200">Round {alloc.roundId.replace('round-', '#')}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{alloc.currency}</p>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {alloc.amount.toLocaleString()} {alloc.currency}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">QF Base</span>
                      <div className="font-medium text-slate-300">{alloc.sqfDetails.qfBase.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Pheromone Mod</span>
                      <div className={`font-medium ${alloc.sqfDetails.pheromoneMod >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {alloc.sqfDetails.pheromoneMod.toFixed(2)}x
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">PageRank Mod</span>
                      <div className={`font-medium ${alloc.sqfDetails.pagerankMod >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {alloc.sqfDetails.pagerankMod.toFixed(2)}x
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evidence & Info */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6">Evidence & Details</h2>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
            <dl className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <dt className="text-sm text-slate-500 sm:w-40">Created</dt>
                <dd className="text-sm text-slate-300">
                  {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </dd>
              </div>
              {project.totalFundingReceived !== undefined && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-slate-500 sm:w-40">Total Funding</dt>
                  <dd className="text-sm font-medium text-emerald-400">
                    {project.totalFundingReceived.toLocaleString()} USDC
                  </dd>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <dt className="text-sm text-slate-500 sm:w-40">Creator</dt>
                <dd className="text-sm text-slate-300 font-mono">
                  {project.createdBy.slice(0, 6)}...{project.createdBy.slice(-4)}
                </dd>
              </div>
              {latestEval && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-slate-500 sm:w-40">Last Evaluated</dt>
                  <dd className="text-sm text-slate-300">
                    {new Date(latestEval.evaluatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </dd>
                </div>
              )}
              {latestEval?.bradleyTerryRank !== undefined && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-slate-500 sm:w-40">Bradley-Terry Rank</dt>
                  <dd className="text-sm font-medium text-violet-400">#{latestEval.bradleyTerryRank}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
