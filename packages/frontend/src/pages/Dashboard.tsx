import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { UserInfo, Round, Project } from '@/lib/types';
import { RoundCard } from '@/components/RoundCard';
import { ProjectCard } from '@/components/ProjectCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorMessage } from '@/components/ErrorMessage';
import { useAuth } from '@/hooks/useAuth';

export function Dashboard() {
  const { address, isConnected } = useAuth();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [user, roundsData, projectsData] = await Promise.all([
        api.getMe(),
        api.getRounds(),
        api.getProjects(),
      ]);
      setUserInfo(user);
      setRounds(roundsData.rounds);
      setProjects(projectsData.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  if (loading) return <LoadingSkeleton type="page" />;
  if (error) return <ErrorMessage message={error} onRetry={fetchDashboard} />;

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h2>
          <p className="text-slate-400 mb-6">
            Connect your wallet to access your dashboard, view your rounds, and track your applications.
          </p>
          <p className="text-sm text-slate-500">
            Use the "Connect Wallet" button in the navigation bar to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-b from-violet-950/30 to-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Welcome back{truncatedAddress ? `, ${truncatedAddress}` : ''}
          </h1>
          <p className="text-slate-400">Manage your grant rounds and track your project applications.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
              </div>
              <span className="text-sm text-slate-400">Rounds Created</span>
            </div>
            <div className="text-3xl font-bold text-white">{userInfo?.roundsCreated ?? rounds.length}</div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <span className="text-sm text-slate-400">Applications Submitted</span>
            </div>
            <div className="text-3xl font-bold text-white">{userInfo?.applicationsSubmitted ?? 0}</div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <span className="text-sm text-slate-400">Avg. Project Score</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {projects.filter(p => p.overallScore).length > 0
                ? (projects.reduce((sum, p) => sum + (p.overallScore || 0), 0) / projects.filter(p => p.overallScore).length).toFixed(1)
                : '—'}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 mb-10">
          <Link
            to="/create-round"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold px-5 py-2.5 rounded-lg hover:from-violet-500 hover:to-cyan-400 transition-all shadow-lg shadow-violet-500/25 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Round
          </Link>
          <Link
            to="/rounds"
            className="inline-flex items-center gap-2 bg-slate-700 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-slate-600 transition-colors text-sm"
          >
            Browse Rounds
          </Link>
        </div>

        {/* My Rounds */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">My Rounds</h2>
            <Link to="/rounds" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
              View all →
            </Link>
          </div>
          {rounds.length === 0 ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-8 text-center">
              <p className="text-slate-500 mb-4">You haven't created any rounds yet.</p>
              <Link
                to="/create-round"
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Create your first round →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rounds.slice(0, 3).map((round) => (
                <RoundCard key={round.id} round={round} />
              ))}
            </div>
          )}
        </section>

        {/* My Applications */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">My Applications</h2>
            <Link to="/rounds" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
              Find rounds →
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-8 text-center">
              <p className="text-slate-500 mb-4">You haven't submitted any applications yet.</p>
              <Link
                to="/rounds"
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Browse open rounds →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.slice(0, 6).map((project) => (
                <ProjectCard key={project.id} project={project} showScore />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
