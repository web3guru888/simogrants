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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <h4 className="font-semibold text-[#e2e0dc]">{meta.label}</h4>
        </div>
        <span className="text-sm font-bold text-[#8a8a9a]">{avgScore.toFixed(1)}</span>
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

      <div className="mt-4 pt-3 border-t border-white/[0.04]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#4a4a5a]">Confidence</span>
          <span className="text-xs font-medium text-[#8a8a9a]">{(evaluation.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-white/[0.04] rounded-full h-1.5">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${meta.color}`}
            style={{ width: `${evaluation.confidence * 100}%` }}
          />
        </div>
      </div>

      {evaluation.narrative && (
        <p className="mt-3 text-xs text-[#6b6a6a] leading-relaxed line-clamp-3">{evaluation.narrative}</p>
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
          <span className="text-[#4a4a5a]">{tension.agents[tension.high_agent]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400">↓ {STAKEHOLDER_META[tension.low_agent]?.label || tension.low_agent}</span>
          <span className="text-[#4a4a5a]">{tension.agents[tension.low_agent]}</span>
        </div>
      </div>
      <p className="text-xs text-[#6b6a6a] leading-relaxed">{tension.narrative}</p>
    </div>
  );
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProjectDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = async () => {
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
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  if (loading) return <LoadingSkeleton type="page" />;
  if (error) return <ErrorMessage message={error} onRetry={fetchProject} />;
  if (!data) return null;

  const { project, evaluations, allocations } = data;
  const latestEval = evaluations[0];

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/rounds"
            className="inline-flex items-center gap-2 text-sm text-[#6b6a6a] hover:text-amber-400 transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Rounds
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-[#e2e0dc]">{project.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/[0.04] text-[#8a8a9a] capitalize border border-white/[0.08]">
                  {project.category.replace(/-/g, ' ')}
                </span>
              </div>
              <p className="text-[#6b6a6a] max-w-2xl mb-4">{project.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#4a4a5a]">
                {project.website && (
                  <a href={project.website} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-400 transition-colors">
                    🌐 Website
                  </a>
                )}
                {project.githubUrl && (
                  <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-400 transition-colors">
                    📂 GitHub
                  </a>
                )}
                <span>👥 {project.teamSize} team members</span>
              </div>
            </div>

            {project.overallScore != null && (
              <div className="text-center shrink-0">
                <div className="text-4xl font-bold text-amber-400">
                  {Number(project.overallScore).toFixed(1)}
                </div>
                <div className="text-xs text-[#4a4a5a] uppercase tracking-wider mt-1">Overall Score</div>
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
            <h2 className="text-xl font-bold text-[#e2e0dc] mb-6">Stakeholder Evaluations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(latestEval.stakeholderEvaluations).map(([name, evaluation]) => (
                <StakeholderCard key={name} name={name} evaluation={evaluation} />
              ))}
            </div>
          </section>
        )}

        {/* Aggregated Scores */}
        {latestEval?.aggregatedScores && Object.keys(latestEval.aggregatedScores).length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-[#e2e0dc] mb-6">Aggregated Scores</h2>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
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
            <h2 className="text-xl font-bold text-[#e2e0dc] mb-6">Tension Analysis</h2>
            <div className="space-y-4">
              {latestEval.tensions.map((tension, i) => (
                <TensionCard key={i} tension={tension} />
              ))}
            </div>
          </section>
        )}

        {/* Allocation History */}
        {allocations.length === 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-[#e2e0dc] mb-6">Allocation History</h2>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <p className="text-[#6b6a6a]">This project hasn't received any funding allocations yet.</p>
            </div>
          </section>
        )}
        {allocations.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-[#e2e0dc] mb-6">Allocation History</h2>
            <div className="space-y-3">
              {allocations.map((alloc, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-semibold text-[#e2e0dc]">Round {alloc.roundId.replace('round-', '#')}</h4>
                      <p className="text-xs text-[#4a4a5a] mt-0.5">{alloc.currency}</p>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {alloc.amount.toLocaleString()} {alloc.currency}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-[#4a4a5a]">QF Base</span>
                      <div className="font-medium text-[#8a8a9a]">{alloc.sqfDetails?.qfBase?.toLocaleString() ?? '—'}</div>
                    </div>
                    <div>
                      <span className="text-[#4a4a5a]">Pheromone Mod</span>
                      <div className={`font-medium ${(alloc.sqfDetails?.pheromoneMod ?? 1) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {alloc.sqfDetails?.pheromoneMod?.toFixed(2) ?? '—'}x
                      </div>
                    </div>
                    <div>
                      <span className="text-[#4a4a5a]">PageRank Mod</span>
                      <div className={`font-medium ${(alloc.sqfDetails?.pagerankMod ?? 1) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {alloc.sqfDetails?.pagerankMod?.toFixed(2) ?? '—'}x
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
          <h2 className="text-xl font-bold text-[#e2e0dc] mb-6">Evidence & Details</h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <dl className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <dt className="text-sm text-[#4a4a5a] sm:w-40">Created</dt>
                <dd className="text-sm text-[#8a8a9a]">
                  {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </dd>
              </div>
              {project.totalFundingReceived !== undefined && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-[#4a4a5a] sm:w-40">Total Funding</dt>
                  <dd className="text-sm font-medium text-emerald-400">
                    {project.totalFundingReceived.toLocaleString()} USDC
                  </dd>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <dt className="text-sm text-[#4a4a5a] sm:w-40">Creator</dt>
                <dd className="text-sm text-[#8a8a9a] font-mono">
                  {project.createdBy.slice(0, 6)}...{project.createdBy.slice(-4)}
                </dd>
              </div>
              {latestEval && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-[#4a4a5a] sm:w-40">Last Evaluated</dt>
                  <dd className="text-sm text-[#8a8a9a]">
                    {new Date(latestEval.evaluatedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </dd>
                </div>
              )}
              {latestEval?.bradleyTerryRank !== undefined && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-[#4a4a5a] sm:w-40">Bradley-Terry Rank</dt>
                  <dd className="text-sm font-medium text-amber-400">#{latestEval.bradleyTerryRank}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
