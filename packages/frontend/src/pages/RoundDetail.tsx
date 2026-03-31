import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import type { Address } from 'viem';
import { api } from '@/lib/api';
import { getExplorerUrl } from '@/lib/explorer';
import { useRoundOnChainStatus, useOnChainApplicationIds, useFactoryRoundCount, useStartEvaluation } from '@/hooks/useContracts';
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

  const { isConnected, address } = useAccount();
  const roundAddress = data?.round?.contractAddress as Address | undefined;
  const validRoundAddress = roundAddress && roundAddress !== '0x0000000000000000000000000000000000000000' ? roundAddress : undefined;
  const { data: onChainStatus } = useRoundOnChainStatus(validRoundAddress);
  const { data: onChainAppIds } = useOnChainApplicationIds(validRoundAddress);
  const { data: factoryCount } = useFactoryRoundCount();
  const { startEvaluation: startEvalOnChain } = useStartEvaluation();

  if (loading) return <LoadingSkeleton type="page" />;
  if (error) return <ErrorMessage message={error} onRetry={fetchRound} />;
  if (!data) return null;

  const { round, applications, statistics } = data;
  const deadline = new Date(round.applicationDeadline);
  const isExpired = deadline < new Date();
  const canApply = round.status === 'active' || round.status === 'accepting';
  const appCount = applications.length;

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

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-[#e2e0dc]">{round.title}</h1>
                <StatusBadge status={round.status} />
              </div>
              <p className="text-[#6b6a6a] max-w-2xl">{round.description}</p>
            </div>

            <div className="flex flex-wrap gap-3 shrink-0">
              {canApply && (
                <Link
                  to={`/rounds/${round.id}/apply`}
                  className="inline-flex items-center gap-2 bg-amber-500 text-[#0a0a12] font-semibold px-6 py-2.5 rounded-lg hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/15"
                >
                  Apply to This Round
                </Link>
              )}
              {(round.status === 'funded' || round.status === 'closed') && (
                <Link
                  to={`/rounds/${round.id}/results`}
                  className="inline-flex items-center gap-2 bg-white/[0.04] text-[#e2e0dc] font-semibold px-6 py-2.5 rounded-lg hover:bg-white/[0.08] transition-colors"
                >
                  View Results
                </Link>
              )}
              {isConnected && address && round.creatorAddress === address && (round.status === 'accepting' || round.status === 'evaluating' || round.status === 'active') && (
                <button
                  onClick={async () => {
                    try {
                      // Transition on-chain state if contract exists
                      if (validRoundAddress) {
                        try { await startEvalOnChain(validRoundAddress); } catch {}
                      }
                      // Trigger ASI1 evaluation via backend
                      await api.triggerEvaluation(round.id);
                      fetchRound();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Evaluation failed');
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-emerald-600 text-[#e2e0dc] font-semibold px-6 py-2.5 rounded-lg hover:bg-emerald-500 transition-colors"
                >
                  Run AI Evaluation
                </button>
              )}
            </div>
          </div>

          {/* Round Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <div className="text-xs text-[#4a4a5a] uppercase tracking-wider mb-1">Matching Pool</div>
              <div className="text-xl font-bold text-amber-400">
                {round.matchingPool.toLocaleString()} <span className="text-sm text-[#6b6a6a]">{round.currency}</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <div className="text-xs text-[#4a4a5a] uppercase tracking-wider mb-1">Applications</div>
              <div className="text-xl font-bold text-[#e2e0dc]">
                {appCount} <span className="text-sm text-[#6b6a6a]">/ {round.maxApplications}</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <div className="text-xs text-[#4a4a5a] uppercase tracking-wider mb-1">Deadline</div>
              <div className={`text-xl font-bold ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                {deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <div className="text-xs text-[#4a4a5a] uppercase tracking-wider mb-1">Chain</div>
              <div className="text-xl font-bold text-teal-400 capitalize">{round.chain}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
          {(['applications', 'details'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-[#6b6a6a] hover:text-[#e2e0dc]'
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
                <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#3a3a4a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#8a8a9a] mb-2">No applications yet</h3>
                <p className="text-[#4a4a5a]">Be the first to apply to this round!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app: Application) => (
                  <Link
                    key={app.id}
                    to={`/projects/${app.projectId}`}
                    className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-amber-500/20 transition-all group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-[#e2e0dc] group-hover:text-amber-400 transition-colors">
                            {app.projectName}
                          </h3>
                          <StatusBadge status={app.status} />
                        </div>
                        <p className="text-xs text-[#4a4a5a]">
                          Applied {new Date(app.appliedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          {app.evaluatedAt && (
                            <span className="ml-3">
                              · Evaluated {new Date(app.evaluatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </p>
                      </div>
                      {(app.projectScore ?? app.overallScore) != null && (
                        <div className="w-48 shrink-0">
                          <ScoreBar score={app.projectScore ?? app.overallScore ?? 0} label="Overall Score" color="amber" />
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
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h3 className="text-lg font-semibold text-[#e2e0dc] mb-4">Statistics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-[#4a4a5a] uppercase tracking-wider mb-1">Total Applications</div>
                  <div className="text-xl font-bold text-[#e2e0dc]">{appCount}</div>
                </div>
                <div>
                  <div className="text-xs text-[#4a4a5a] uppercase tracking-wider mb-1">Matching Pool</div>
                  <div className="text-xl font-bold text-amber-400">{statistics.totalMatchingPool.toLocaleString()} {round.currency}</div>
                </div>
                <div>
                  <div className="text-xs text-[#4a4a5a] uppercase tracking-wider mb-1">Allocated</div>
                  <div className="text-xl font-bold text-emerald-400">{statistics.allocated.toLocaleString()} {round.currency}</div>
                </div>
                <div>
                  <div className="text-xs text-[#4a4a5a] uppercase tracking-wider mb-1">Avg. Score</div>
                  <div className="text-xl font-bold text-amber-400">{statistics.averageScore != null ? statistics.averageScore.toFixed(1) : '—'}</div>
                </div>
              </div>
            </div>

            {/* Round Info */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h3 className="text-lg font-semibold text-[#e2e0dc] mb-4">Round Information</h3>
              <dl className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-[#4a4a5a] sm:w-40">Created</dt>
                  <dd className="text-sm text-[#8a8a9a]">{new Date(round.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-[#4a4a5a] sm:w-40">Last Updated</dt>
                  <dd className="text-sm text-[#8a8a9a]">{new Date(round.updatedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <dt className="text-sm text-[#4a4a5a] sm:w-40">Creator</dt>
                  <dd className="text-sm text-[#8a8a9a] font-mono">{round.creatorAddress.slice(0, 6)}...{round.creatorAddress.slice(-4)}</dd>
                </div>
                {round.contractAddress && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <dt className="text-sm text-[#4a4a5a] sm:w-40">Contract</dt>
                    <dd>
                      <a
                        href={getExplorerUrl(84532, round.contractAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-amber-400 hover:text-amber-400 font-mono transition-colors"
                      >
                        {round.contractAddress.slice(0, 10)}...{round.contractAddress.slice(-8)}
                        <svg className="inline w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </dd>
                  </div>
                )}
                {onChainStatus !== undefined && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <dt className="text-sm text-[#4a4a5a] sm:w-40">On-Chain Status</dt>
                    <dd className="text-sm text-emerald-400 font-medium">
                      {['Created', 'Accepting', 'Evaluating', 'Distributing', 'Closed'][Number(onChainStatus)] || 'Unknown'}
                    </dd>
                  </div>
                )}
                {onChainAppIds !== undefined && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <dt className="text-sm text-[#4a4a5a] sm:w-40">On-Chain Applications</dt>
                    <dd className="text-sm text-[#8a8a9a]">{(onChainAppIds as bigint[])?.length ?? 0}</dd>
                  </div>
                )}
                {factoryCount !== undefined && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <dt className="text-sm text-[#4a4a5a] sm:w-40">Factory Round Count</dt>
                    <dd className="text-sm text-[#8a8a9a]">{Number(factoryCount)}</dd>
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
