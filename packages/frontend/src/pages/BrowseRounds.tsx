import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Round } from '@/lib/types';
import { RoundCard } from '@/components/RoundCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorMessage } from '@/components/ErrorMessage';

type FilterTab = 'all' | 'active' | 'accepting' | 'funded';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All Rounds' },
  { key: 'active', label: 'Active' },
  { key: 'accepting', label: 'Accepting' },
  { key: 'funded', label: 'Funded' },
];

export function BrowseRounds() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRounds = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = activeTab === 'all' ? {} : { status: activeTab };
      const data = await api.getRounds(params);
      setRounds(data.rounds);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rounds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();
  }, [activeTab]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#e2e0dc] mb-3">Grant Rounds</h1>
          <p className="text-[#6b6a6a] max-w-2xl">
            Browse open grant rounds, discover projects, and apply for funding. Each round is evaluated by our multi-agent AI system.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                  : 'bg-white/[0.03] text-[#6b6a6a] border border-white/[0.06] hover:text-[#e2e0dc] hover:border-white/[0.1]'
              }`}
            >
              {tab.label}
              {tab.key === 'all' && (
                <span className="ml-2 text-xs opacity-60">({total})</span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} type="card" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <ErrorMessage message={error} onRetry={fetchRounds} />
        )}

        {/* Empty State */}
        {!loading && !error && rounds.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-[#3a3a4a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold text-[#e2e0dc] mb-2">No rounds found</h3>
            <p className="text-[#6b6a6a] mb-6">
              {activeTab === 'all'
                ? 'No grant rounds have been created yet.'
                : `No ${activeTab} rounds at the moment.`}
            </p>
          </div>
        )}

        {/* Round Grid */}
        {!loading && !error && rounds.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#6b6a6a]">
                Showing {rounds.length} {rounds.length === 1 ? 'round' : 'rounds'}
                {activeTab !== 'all' && (
                  <span className="ml-1">
                    with status <span className="capitalize text-amber-400">{activeTab}</span>
                  </span>
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rounds.map((round) => (
                <RoundCard key={round.id} round={round} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
