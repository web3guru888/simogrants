import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useChainId } from 'wagmi';
import { api } from '@/lib/api';
import { getAddresses, isContractsDeployed } from '@/lib/contractsConfig';
import type { RoundResults as RoundResultsType } from '@/lib/types';
import { ScoreBar } from '@/components/ScoreBar';
import { AllocationBar } from '@/components/AllocationBar';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorMessage } from '@/components/ErrorMessage';

export function RoundResults() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RoundResultsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const results = await api.getRoundResults(id);
      setData(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [id]);

  const chainId = useChainId();
  const contractsReady = isContractsDeployed(chainId);
  const addresses = getAddresses(chainId);

  if (loading) return <LoadingSkeleton type="page" />;
  if (error) return <ErrorMessage message={error} onRetry={fetchResults} />;
  if (!data) return null;

  const { round, results, summary } = data;
  const maxAllocation = Math.max(...results.map(r => r.allocation), 1);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-b from-violet-950/30 to-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to={`/rounds/${id}`}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-violet-300 transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Round
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Round Results</h1>
            <StatusBadge status={round.status} />
          </div>
          <p className="text-slate-400">{round.title}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Pool</div>
            <div className="text-2xl font-bold text-cyan-400">
              {summary.totalPool.toLocaleString()}
              <span className="text-sm text-slate-400 ml-1">{round.currency}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Allocated</div>
            <div className="text-2xl font-bold text-emerald-400">
              {summary.totalAllocated.toLocaleString()}
              <span className="text-sm text-slate-400 ml-1">{round.currency}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Projects Funded</div>
            <div className="text-2xl font-bold text-violet-400">{summary.projectsFunded}</div>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Average Score</div>
            <div className="text-2xl font-bold text-blue-400">{summary.averageScore.toFixed(1)}</div>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">On-Chain</div>
            <div className="text-2xl font-bold text-emerald-400">
              {contractsReady ? (
                <a
                  href={`https://sepolia.basescan.org/address/${addresses.AttestationRegistry}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-300 transition-colors"
                >
                  Verified
                  <svg className="inline w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : 'Off-Chain'}
            </div>
          </div>
        </div>

        {/* Allocation Visualization */}
        {results.length > 0 && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-6">Funding Allocation</h2>
            <div className="space-y-4">
              {results.map((entry) => (
                <AllocationBar
                  key={entry.rank}
                  amount={entry.allocation}
                  total={summary.totalAllocated || 1}
                  label={`#${entry.rank} ${entry.project.name}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Rankings Table */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-white">Rankings</h2>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Rank</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Project</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3 w-48">Score</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">SQF Allocation</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">QF Base</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Pheromone</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">PageRank</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Attestation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {results.map((entry) => (
                  <tr key={entry.rank} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                        entry.rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        entry.rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30' :
                        entry.rank === 3 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        'bg-slate-700/50 text-slate-400'
                      }`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/projects/${entry.project.id}`} className="text-sm font-semibold text-slate-100 hover:text-violet-300 transition-colors">
                        {entry.project.name}
                      </Link>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">{entry.project.category.replace(/-/g, ' ')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <ScoreBar score={entry.score} size="sm" color={entry.rank === 1 ? 'amber' : 'violet'} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-emerald-400">
                        {entry.allocation.toLocaleString()} <span className="text-xs text-slate-500">{round.currency}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {entry.sqfDetails?.qfBase?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${(entry.sqfDetails?.pheromoneMod ?? 1) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.sqfDetails?.pheromoneMod?.toFixed(2) ?? '—'}x
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${(entry.sqfDetails?.pagerankMod ?? 1) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.sqfDetails?.pagerankMod?.toFixed(2) ?? '—'}x
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {contractsReady ? (
                        <a
                          href={`https://sepolia.basescan.org/address/${addresses.AttestationRegistry}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                        >
                          On-Chain
                          <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.attestationStatus === 'attested'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {entry.attestationStatus === 'attested' ? '✓ Attested' : '⏳ Pending'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-slate-700/30">
            {results.map((entry) => (
              <div key={entry.rank} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                      entry.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                      entry.rank === 2 ? 'bg-slate-400/20 text-slate-300' :
                      entry.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-slate-700/50 text-slate-400'
                    }`}>
                      #{entry.rank}
                    </span>
                    <Link to={`/projects/${entry.project.id}`} className="text-sm font-semibold text-slate-100 hover:text-violet-300">
                      {entry.project.name}
                    </Link>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">
                    {entry.allocation.toLocaleString()} {round.currency}
                  </span>
                </div>
                <ScoreBar score={entry.score} size="sm" color="violet" />
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>QF: {entry.sqfDetails?.qfBase?.toLocaleString() ?? '—'}</span>
                  <span className={(entry.sqfDetails?.pheromoneMod ?? 1) >= 1 ? 'text-emerald-400' : 'text-red-400'}>
                    Phero: {entry.sqfDetails?.pheromoneMod?.toFixed(2) ?? '—'}x
                  </span>
                  <span className={(entry.sqfDetails?.pagerankMod ?? 1) >= 1 ? 'text-emerald-400' : 'text-red-400'}>
                    PR: {entry.sqfDetails?.pagerankMod?.toFixed(2) ?? '—'}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
