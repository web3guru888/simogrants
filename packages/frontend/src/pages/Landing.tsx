import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

const FEATURES = [
  {
    title: 'Multi-Agent Evaluation',
    description: 'Four AI stakeholder agents — Developer, User, Funder, Ecosystem — independently score every project across 12 dimensions.',
    accent: 'amber',
  },
  {
    title: 'Stigmergic QF',
    description: 'Quadratic funding enhanced with pheromone trail modifiers and PageRank network effects. The colony finds signal in the noise.',
    accent: 'teal',
  },
  {
    title: 'On-Chain Attestation',
    description: 'Every evaluation is attested on Base blockchain. Transparent, verifiable, immutable — a permanent record of impact assessment.',
    accent: 'amber',
  },
];

const STEPS = [
  { num: '01', title: 'Create Round', description: 'Define a grant round with matching pool, criteria, and evaluation parameters.' },
  { num: '02', title: 'Projects Apply', description: 'Teams submit projects with descriptions, GitHub repos, and team details.' },
  { num: '03', title: 'Agents Evaluate', description: 'AI stakeholder agents score, SQF allocates, results attest on-chain.' },
];

export function Landing() {
  const [stats, setStats] = useState({ dimensions: '12', agents: '4', pool: '$500K', tests: '104' });

  useEffect(() => {
    api.getRounds().then(data => {
      const totalPool = data.rounds.reduce((s: number, r: any) => s + (r.matchingPool || 0), 0);
      if (totalPool > 0) {
        setStats(prev => ({ ...prev, pool: `$${(totalPool / 1000).toFixed(0)}K` }));
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0e17] via-[#0a0a12] to-[#0a0a12]" />
        <div className="absolute inset-0 dot-grid" />

        {/* Floating orbs — organic motion */}
        <div className="absolute top-16 left-[10%] w-80 h-80 bg-amber-500/[0.06] rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-20 right-[15%] w-96 h-96 bg-teal-500/[0.05] rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/[0.03] rounded-full blur-[150px] animate-float-delay" />

        {/* Trail lines — pheromone paths */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <line x1="10%" y1="20%" x2="50%" y2="45%" stroke="#e5a54b" strokeWidth="1" className="animate-trail" />
          <line x1="50%" y1="45%" x2="85%" y2="30%" stroke="#e5a54b" strokeWidth="1" className="animate-trail" style={{ animationDelay: '1s' }} />
          <line x1="50%" y1="45%" x2="30%" y2="75%" stroke="#3ecfaf" strokeWidth="1" className="animate-trail" style={{ animationDelay: '2s' }} />
          <line x1="30%" y1="75%" x2="70%" y2="80%" stroke="#3ecfaf" strokeWidth="1" className="animate-trail" style={{ animationDelay: '0.5s' }} />
          <circle cx="50%" cy="45%" r="3" fill="#e5a54b" className="animate-trail" />
          <circle cx="10%" cy="20%" r="2" fill="#e5a54b" opacity="0.5" />
          <circle cx="85%" cy="30%" r="2" fill="#e5a54b" opacity="0.5" />
          <circle cx="30%" cy="75%" r="2" fill="#3ecfaf" opacity="0.5" />
          <circle cx="70%" cy="80%" r="2" fill="#3ecfaf" opacity="0.5" />
        </svg>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32 sm:pt-32 sm:pb-40">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="animate-fade-up inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full border border-amber-500/20 bg-amber-500/[0.05]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-medium text-amber-400/80 uppercase tracking-widest">Stigmergic Intelligence</span>
            </div>

            <h1 className="animate-fade-up delay-100 font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[0.95] mb-6">
              <span className="text-[#e2e0dc]">Grant evaluation</span>
              <br />
              <span className="text-amber-400">reimagined.</span>
            </h1>

            <p className="animate-fade-up delay-200 text-lg sm:text-xl text-[#8a8a9a] max-w-xl mb-10 leading-relaxed">
              AI agents coordinate through pheromone signals — like ant colonies — to evaluate and fund Ethereum public goods. Transparent. Reproducible. On-chain.
            </p>

            {/* CTA */}
            <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-start gap-4">
              <Link
                to="/rounds"
                className="group inline-flex items-center gap-2.5 bg-amber-500 text-[#0a0a12] font-semibold px-7 py-3.5 rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.98]"
              >
                Browse Rounds
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                to="/create-round"
                className="inline-flex items-center gap-2 border border-white/[0.1] text-[#e2e0dc] font-medium px-7 py-3.5 rounded-xl hover:bg-white/[0.04] hover:border-white/[0.15] transition-all active:scale-[0.98]"
              >
                Create Round
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: stats.dimensions, label: 'Scoring Dimensions' },
              { value: stats.agents, label: 'AI Agents' },
              { value: stats.pool, label: 'Pool Evaluated' },
              { value: stats.tests, label: 'Contract Tests' },
            ].map((stat, i) => (
              <div key={stat.label} className={`animate-fade-up delay-${(i + 1) * 100} text-center`}>
                <div className="font-display text-3xl sm:text-4xl font-bold text-amber-400 mb-1">
                  {stat.value}
                </div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#e2e0dc] mb-4">
              How the colony works
            </h2>
            <p className="text-[#6b6a6a] max-w-lg">
              Inspired by ant colony optimization — AI agents leave evaluation trails that guide funding to the most impactful projects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={`animate-fade-up delay-${(i + 1) * 100} group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 hover:border-${feature.accent === 'amber' ? 'amber' : 'teal'}-500/20 hover:bg-white/[0.03] transition-all duration-500`}
              >
                <div className={`w-10 h-10 rounded-lg bg-${feature.accent === 'amber' ? 'amber' : 'teal'}-500/10 border border-${feature.accent === 'amber' ? 'amber' : 'teal'}-500/20 flex items-center justify-center mb-5`}>
                  <div className={`w-2 h-2 rounded-full bg-${feature.accent === 'amber' ? 'amber' : 'teal'}-400`} />
                </div>
                <h3 className="font-display text-lg font-bold text-[#e2e0dc] mb-3">{feature.title}</h3>
                <p className="text-sm text-[#6b6a6a] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="py-24 sm:py-32 border-t border-white/[0.06] relative">
        <div className="absolute inset-0 dot-grid opacity-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#e2e0dc] mb-4">Three steps</h2>
            <p className="text-[#6b6a6a]">From round creation to on-chain attestation.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={`animate-fade-up delay-${(i + 1) * 200} relative p-8 ${i < 2 ? 'md:border-r border-white/[0.06]' : ''}`}
              >
                <span className="font-display text-6xl font-extrabold text-white/[0.04] absolute top-4 right-6 select-none">
                  {step.num}
                </span>
                <div className="relative">
                  <span className="text-xs font-display font-semibold text-amber-400/60 uppercase tracking-widest mb-3 block">Step {step.num}</span>
                  <h3 className="font-display text-xl font-bold text-[#e2e0dc] mb-3">{step.title}</h3>
                  <p className="text-sm text-[#6b6a6a] leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-24 sm:py-32 border-t border-white/[0.06] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-amber-500/[0.03] to-transparent" />
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#e2e0dc] mb-6">
            Ready to fund what matters?
          </h2>
          <p className="text-[#6b6a6a] mb-10 leading-relaxed">
            Join grant rounds powered by stigmergic intelligence, or create your own.
          </p>
          <Link
            to="/rounds"
            className="group inline-flex items-center gap-2.5 bg-amber-500 text-[#0a0a12] font-semibold px-8 py-4 rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.98]"
          >
            Get Started
            <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
