import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { api } from '@/lib/api';
import { useApplyToRound as useApplyOnChain } from '@/hooks/useContracts';
import type { Round } from '@/lib/types';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorMessage } from '@/components/ErrorMessage';

const CATEGORIES = [
  { value: 'developer-tooling', label: 'Developer Tooling' },
  { value: 'defi', label: 'DeFi' },
  { value: 'governance', label: 'Governance' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'education', label: 'Education' },
  { value: 'community', label: 'Community' },
  { value: 'identity', label: 'Identity' },
  { value: 'other', label: 'Other' },
];

interface FormData {
  name: string;
  description: string;
  website: string;
  githubUrl: string;
  teamSize: number;
  category: string;
}

const initialForm: FormData = {
  name: '',
  description: '',
  website: '',
  githubUrl: '',
  teamSize: 1,
  category: 'developer-tooling',
};

export function ApplyToRound() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { apply: applyOnChain, isPending: txPending, isConfirming, error: txError } = useApplyOnChain();
  const [round, setRound] = useState<Round | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRound() {
      if (!id) return;
      try {
        const data = await api.getRound(id);
        setRound(data.round);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load round');
      } finally {
        setLoading(false);
      }
    }
    fetchRound();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !form.name.trim() || !form.description.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Create project in backend
      const project = await api.createProject({
        name: form.name.trim(),
        description: form.description.trim(),
        website: form.website.trim() || undefined,
        githubUrl: form.githubUrl.trim() || undefined,
        teamSize: form.teamSize,
        category: form.category,
      });

      // Step 2: Apply to round in backend
      await api.applyToRound(id, project.id);

      // Step 3: Submit on-chain if wallet connected and round has contract address
      if (isConnected && round?.contractAddress &&
          round.contractAddress !== '0x0000000000000000000000000000000000000000') {
        try {
          const metadataURI = JSON.stringify({
            projectId: project.id,
            name: form.name.trim(),
            category: form.category,
          });
          await applyOnChain({
            roundAddress: round.contractAddress as `0x${string}`,
            metadataURI,
          });
        } catch {
          // Backend application succeeded; on-chain recording can be retried from round page
          setError('Application submitted, but on-chain recording failed. You can retry from the round page.');
        }
      }

      // Redirect to round detail
      navigate(`/rounds/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) return <LoadingSkeleton type="page" />;
  if (error && !submitting) return <ErrorMessage message={error} />;
  if (!round) return null;

  const canApply = round.status === 'active' || round.status === 'accepting';

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back Link */}
        <Link
          to={`/rounds/${id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-violet-300 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to {round.title}
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Apply to Round</h1>
          <p className="text-slate-400">Submit your project for evaluation in <span className="text-violet-300">{round.title}</span></p>
        </div>

        {!canApply ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
            <svg className="w-12 h-12 text-amber-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <h3 className="text-lg font-semibold text-amber-300 mb-2">Applications Closed</h3>
            <p className="text-slate-400">This round is no longer accepting applications.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* On-chain info */}
            {isConnected && round?.contractAddress && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-sm text-emerald-300">Your application will be recorded on-chain via the round's smart contract.</p>
              </div>
            )}

            {/* Error banner */}
            {(error || txError) && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-sm text-red-300">{error || txError?.message}</p>
              </div>
            )}

            {/* Project Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                Project Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="My Awesome Project"
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                id="description"
                required
                rows={5}
                value={form.description}
                onChange={e => updateField('description', e.target.value)}
                placeholder="Describe your project, what problem it solves, and its impact..."
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors resize-none"
              />
            </div>

            {/* Website & GitHub */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-slate-300 mb-2">
                  Website
                </label>
                <input
                  id="website"
                  type="url"
                  value={form.website}
                  onChange={e => updateField('website', e.target.value)}
                  placeholder="https://myproject.com"
                  className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="github" className="block text-sm font-medium text-slate-300 mb-2">
                  GitHub URL
                </label>
                <input
                  id="github"
                  type="url"
                  value={form.githubUrl}
                  onChange={e => updateField('githubUrl', e.target.value)}
                  placeholder="https://github.com/org/repo"
                  className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            {/* Team Size & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="teamSize" className="block text-sm font-medium text-slate-300 mb-2">
                  Team Size <span className="text-red-400">*</span>
                </label>
                <input
                  id="teamSize"
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={form.teamSize}
                  onChange={e => updateField('teamSize', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-2">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  id="category"
                  value={form.category}
                  onChange={e => updateField('category', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting || txPending || isConfirming || !form.name.trim() || !form.description.trim()}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold px-8 py-3 rounded-lg hover:from-violet-500 hover:to-cyan-400 transition-all shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {txPending || isConfirming || submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {txPending ? 'Confirm in Wallet...' : isConfirming ? 'Waiting for Confirmation...' : 'Submitting...'}
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
              <Link
                to={`/rounds/${id}`}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
