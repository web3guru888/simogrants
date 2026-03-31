import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { api } from '@/lib/api';
import { useCreateRound } from '@/hooks/useContracts';
import { ErrorMessage } from '@/components/ErrorMessage';

interface RoundForm {
  title: string;
  description: string;
  matchingPool: number;
  currency: string;
  chain: string;
  applicationDeadline: string;
  maxApplications: number;
}

const initialForm: RoundForm = {
  title: '',
  description: '',
  matchingPool: 10000,
  currency: 'USDC',
  chain: 'base-sepolia',
  applicationDeadline: '',
  maxApplications: 50,
};

export function CreateRound() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { createRound: createOnChain, isPending: txPending, isConfirming, error: txError } = useCreateRound();
  const [form, setForm] = useState<RoundForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.applicationDeadline) return;

    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Submit on-chain transaction if wallet connected
      let contractAddress: string | undefined;
      if (isConnected) {
        const metadataURI = JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim().slice(0, 500),
        });
        if (new Blob([metadataURI]).size > 2048) {
          setError('Description is too long for on-chain storage. Please shorten it.');
          setSubmitting(false);
          return;
        }
        const txHash = await createOnChain({
          metadataURI,
          matchingPool: form.matchingPool,
          token: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          applicationDeadline: new Date(form.applicationDeadline),
          votingDeadline: new Date(new Date(form.applicationDeadline).getTime() + 14 * 24 * 60 * 60 * 1000),
        });
        if (txHash) {
          contractAddress = txHash;
        }
      }

      // Step 2: Save to backend database
      await api.createRound({
        title: form.title.trim(),
        description: form.description.trim(),
        matchingPool: form.matchingPool,
        currency: form.currency,
        chain: form.chain,
        applicationDeadline: new Date(form.applicationDeadline).toISOString(),
        maxApplications: form.maxApplications,
        ...(contractAddress ? { contractAddress } : {}),
      });
      navigate('/rounds');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create round');
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof RoundForm, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen ">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back Link */}
        <Link
          to="/rounds"
          className="inline-flex items-center gap-2 text-sm text-[#6b6a6a] hover:text-amber-400 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Rounds
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#e2e0dc] mb-2">Create Grant Round</h1>
          <p className="text-[#6b6a6a]">Set up a new grant round for AI-powered project evaluation.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error */}
          {(error || txError) && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-sm text-red-300">{error || txError?.message}</p>
            </div>
          )}

          {/* Wallet prompt */}
          {!isConnected && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm text-amber-300">Connect your wallet to deploy this round on-chain. You can still create a round without a wallet (off-chain only).</p>
            </div>
          )}

          {/* Round Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[#8a8a9a] mb-2">
              Round Title <span className="text-red-400">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="Ethereum Infrastructure Round"
              className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#e2e0dc] placeholder-[#4a4a5a] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="desc" className="block text-sm font-medium text-[#8a8a9a] mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="desc"
              required
              rows={4}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="Describe the focus and goals of this grant round..."
              className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#e2e0dc] placeholder-[#4a4a5a] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          {/* Matching Pool & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="pool" className="block text-sm font-medium text-[#8a8a9a] mb-2">
                Matching Pool (USDC)
              </label>
              <input
                id="pool"
                type="number"
                min={0}
                step={100}
                value={form.matchingPool}
                onChange={e => updateField('matchingPool', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#e2e0dc] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="chain" className="block text-sm font-medium text-[#8a8a9a] mb-2">
                Chain
              </label>
              <select
                id="chain"
                value={form.chain}
                onChange={e => updateField('chain', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#e2e0dc] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              >
                <option value="base-sepolia">Base Sepolia (Testnet)</option>
              </select>
            </div>
          </div>

          {/* Deadline & Max Applications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="deadline" className="block text-sm font-medium text-[#8a8a9a] mb-2">
                Application Deadline <span className="text-red-400">*</span>
              </label>
              <input
                id="deadline"
                type="date"
                required
                value={form.applicationDeadline}
                onChange={e => updateField('applicationDeadline', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#e2e0dc] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="maxApps" className="block text-sm font-medium text-[#8a8a9a] mb-2">
                Max Applications
              </label>
              <input
                id="maxApps"
                type="number"
                min={1}
                max={500}
                value={form.maxApplications}
                onChange={e => updateField('maxApplications', parseInt(e.target.value) || 50)}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#e2e0dc] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={submitting || txPending || isConfirming || !form.title.trim() || !form.description.trim() || !form.applicationDeadline}
              className="inline-flex items-center gap-2 bg-amber-500 text-[#0a0a12] font-semibold px-8 py-3 rounded-lg hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/15 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {txPending || isConfirming || submitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {txPending ? 'Confirm in Wallet...' : isConfirming ? 'Waiting for Confirmation...' : 'Creating...'}
                </>
              ) : (
                isConnected ? 'Create Round (On-Chain)' : 'Create Round'
              )}
            </button>
            <Link
              to="/rounds"
              className="text-sm text-[#6b6a6a] hover:text-[#e2e0dc] transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
