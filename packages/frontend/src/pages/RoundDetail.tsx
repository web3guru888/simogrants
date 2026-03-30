import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { RoundDetail as RoundDetailType, Application } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { ScoreBar } from '@/components/ScoreBar';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorMessage } from '@/components/ErrorMessage';

type Tab = 'applications' | 'details';

export function RoundDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RoundDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('applications');

  const fetchRound = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const roundData = await api.getRound(id);
      setData(roundData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load round');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRound();
  }, [id]);

  if (loading) return <LoadingSkeleton type="page" />;
  if (error) return <ErrorMessage message={error} onRetry={fetchRound} />;
  if (!data) return null;

  const { round, applications, statistics } = data;
  const deadline = new Date(round.applicationDeadline);
  const isExpired = deadline < new Date();
  const canApply = round.status === 'active' || round.status === 'accepting';

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

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{round.title}</h1>
                <StatusBadge status={round.status} />
              </div>
              <p className="text-slate-400 max-w-2xl">{round.description}</p>
            </div>

            <div className="flex flex-wrap gap-3 shrink-0">
              {canApply && (
                <Link
                  to={`/rounds/${round.id}/apply`}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold px-6 py-2.5 rounded-lg hover:from-violet-500 hover:to-cyan-400 transition-all shadow-lg shadow-violet-500/25"
                >
                  Apply to This Round
                </Link>
              )}
              {(round.status === 'funded' || round.status === 'closed') && (
                <Link
                  to={`/rounds/${round.id}/results`}
                  className="inline-flex items-center gap-2 bg-slate-700 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  View Results
                </Link>
              )}
            </div>
          </div>

          {/* Round Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Matching Pool</div>
              <div className="text-xl font-bold text-cyan-400">
                {round.matchingPool.toLocaleString()} <span className="text-sm text-slate-400">{round.currency}</span>
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Applications</div>
              <div className="text-xl font-bold text-slate-200">
                {round.applicationsCount} <span className="text-sm text-slate-400">/ {round.maxApplications}</span>
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Deadline</div>
              <div className={`text-xl font-bold ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Chain</div>
              <div className="text-xl font-bold text-blue-400 capitalize">{round.chain}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-slate-800">
          {(['applications', 'details'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div>
            {applications.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-300 mb-2">No applications yet</h3>
                <p className="text-slate-500">Be the first to apply to this round!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app: Application) => (
                  <Link
                    key={app.id}
                    to={`/projects/${app.projectId}`}
                    className="block rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 hover:border-violet-500/50 transition-all group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-slate-100 group-hover:text-violet-300 transition-colors">
                            {app.projectName}
                          </h3>
                          <StatusBadge status={app.status} />
                        </div>
                        <p className="text-xs text-slate-500">
                          Applied {new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {app.evaluatedAt && (
                            <span className="ml-3">
                              · Evaluated {new Date(app.evaluatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </p>
                      </div>
                      {app.overallScore !== undefined && (
                        <div className="w-48 shrink-0">
                          <ScoreBar score={app.overallScore} label="Overall Score" color="violet" />
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Statistics */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Applications</div>
                  <div className="text-xl font-bold text-white">{statistics.totalApplications}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Matching Pool</div>
                  <div className="text-xl font-bold text-cyan-400">{statistics.totalMatchingPool.toLocaleString()} {round.currency}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Allocated</div>
                  <div className="text-xl font-bold text-emerald-400">{statistics.allocated.toLocaleString()} {round.currency}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg. Score</div>
                  <div className="text-xl font-bold text-violet-400">{statistics.averageScore.toFixed(1)}</div>
                </div>
              </div>
            </div>

            {/* Round Info */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Round Information</h3>
              <dl className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-slate-500 sm:w-40">Created</dt>
                  <dd className="text-sm text-slate-300">{new Date(round.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-slate-500 sm:w-40">Last Updated</dt>
                  <dd className="text-sm text-slate-300">{new Date(round.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-slate-500 sm:w-40">Creator</dt>
                  <dd className="text-sm text-slate-300 font-mono">{round.creatorAddress.slice(0, 6)}...{round.creatorAddress.slice(-4)}</dd>
                </div>
                {round.contractAddress && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <dt className="text-sm text-slate-500 sm:w-40">Contract</dt>
                    <dd className="text-sm text-slate-300 font-mono">{round.contractAddress.slice(0, 10)}...{round.contractAddress.slice(-8)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
