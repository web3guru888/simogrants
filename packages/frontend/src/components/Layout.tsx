import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ConnectButton } from './ConnectButton';

const NAV_LINKS = [
  { path: '/', label: 'Home' },
  { path: '/rounds', label: 'Rounds' },
  { path: '/create-round', label: 'Create Round' },
  { path: '/dashboard', label: 'Dashboard' },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/20">
                S
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                SIMOGRANTS
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'text-violet-300 bg-violet-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Wallet + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <ConnectButton />
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-xl">
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'text-violet-300 bg-violet-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
                  S
                </div>
                <span className="font-bold text-sm text-slate-300">SIMOGRANTS</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Stigmergic Impact Oracle for Grants — AI-powered multi-agent evaluation with quadratic funding on-chain.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Platform</h4>
              <div className="space-y-2">
                <Link to="/rounds" className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">Browse Rounds</Link>
                <Link to="/create-round" className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">Create Round</Link>
                <Link to="/dashboard" className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">Dashboard</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Built On</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-400">Base</span>
                <span className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-400">Cloudflare Workers</span>
                <span className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-400">AI Agents</span>
                <span className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-400">Quadratic Funding</span>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
            <p className="text-xs text-slate-600">© 2026 SIMOGRANTS — Built for ETHGlobal</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
