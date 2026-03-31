import { Link } from 'react-router-dom';
import type { Round } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

interface RoundCardProps {
  round: Round;
}

export function RoundCard({ round }: RoundCardProps) {
  const deadline = new Date(round.applicationDeadline);
  const isExpired = deadline < new Date();
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <Link
      to={`/rounds/${round.id}`}
      data-testid="round-card"
      data-round-id={round.id}
      className="group block rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm p-5 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-100 group-hover:text-violet-300 transition-colors line-clamp-1">
          {round.title}
        </h3>
        <StatusBadge status={round.status} />
      </div>

      <p className="text-sm text-slate-400 mb-4 line-clamp-2">{round.description}</p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Pool</div>
          <div className="text-sm font-semibold text-cyan-400">
            {round.matchingPool.toLocaleString()} {round.currency}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Applications</div>
          <div className="text-sm font-semibold text-slate-200">
            {(round.applicationsCount ?? 0)}/{round.maxApplications}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Deadline</div>
          <div className={`text-sm font-semibold ${isExpired ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {isExpired ? 'Closed' : `${daysLeft}d left`}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs text-slate-500 font-mono">{round.chain}</span>
        </div>
        <span className="text-xs text-violet-400 group-hover:text-violet-300 transition-colors">
          View Details →
        </span>
      </div>
    </Link>
  );
}
