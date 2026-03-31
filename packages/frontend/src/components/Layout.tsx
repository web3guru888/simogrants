import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ConnectButton } from './ConnectButton';

const NAV_LINKS = [
  { path: '/', label: 'Home' },
  { path: '/rounds', label: 'Rounds' },
  { path: '/create-round', label: 'Create' },
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
    <div className="min-h-screen flex flex-col bg-[#0a0a12] text-[#e2e0dc] noise-bg">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a12]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/15 group-hover:shadow-amber-500/30 transition-shadow">
                <svg className="w-4.5 h-4.5 text-[#0a0a12]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" />
                  <path d="M12 12L20 7.5M12 12V21M12 12L4 7.5" strokeOpacity="0.5" />
                </svg>
              </div>
              <span className="text-lg font-display font-bold tracking-tight text-[#e2e0dc]">
                SIMO<span className="text-amber-400">GRANTS</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-0.5">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(link.path)
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-[#8a8a9a] hover:text-[#e2e0dc] hover:bg-white/[0.04]'
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
                className="md:hidden p-2 rounded-lg text-[#8a8a9a] hover:text-[#e2e0dc] hover:bg-white/[0.04] transition-colors"
                aria-label="Toggle menu"
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
          <div className="md:hidden border-t border-white/[0.06] bg-[#0a0a12]/95 backdrop-blur-xl">
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-[#8a8a9a] hover:text-[#e2e0dc] hover:bg-white/[0.04]'
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
      <main className="flex-1 relative z-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[#0a0a12]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" />
                  </svg>
                </div>
                <span className="font-display font-bold text-sm text-[#e2e0dc]">SIMO<span className="text-amber-400">GRANTS</span></span>
              </div>
              <p className="text-xs text-[#6b6a6a] leading-relaxed max-w-xs">
                Stigmergic Impact Oracle — ASI1-powered agents coordinate through pheromone signals to evaluate and fund Ethereum public goods on Base Sepolia.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-display font-semibold text-[#8a8a9a] uppercase tracking-widest mb-3">Platform</h4>
              <div className="space-y-2">
                <Link to="/rounds" className="block text-xs text-[#6b6a6a] hover:text-amber-400 transition-colors">Browse Rounds</Link>
                <Link to="/create-round" className="block text-xs text-[#6b6a6a] hover:text-amber-400 transition-colors">Create Round</Link>
                <Link to="/dashboard" className="block text-xs text-[#6b6a6a] hover:text-amber-400 transition-colors">Dashboard</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-display font-semibold text-[#8a8a9a] uppercase tracking-widest mb-3">Built On</h4>
              <div className="flex flex-wrap gap-2">
                {['Base Sepolia', 'ASI1', 'Cloudflare', 'SQF'].map(tag => (
                  <span key={tag} className="px-2.5 py-1 text-xs rounded-full border border-white/[0.08] text-[#6b6a6a]">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
            <p className="text-xs text-[#3a3a4a]">&copy; 2026 SIMOGRANTS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
