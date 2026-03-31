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
      className="group block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-amber-500/20 hover:bg-white/[0.03] transition-all duration-500"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-display text-lg font-bold text-[#e2e0dc] group-hover:text-amber-400 transition-colors line-clamp-1">
          {round.title}
        </h3>
        <StatusBadge status={round.status} />
      </div>

      <p className="text-sm text-[#6b6a6a] mb-5 line-clamp-2">{round.description}</p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div>
          <div className="text-[10px] text-[#4a4a5a] uppercase tracking-widest font-medium">Pool</div>
          <div className="text-sm font-semibold text-amber-400 tabular-nums">
            {round.matchingPool.toLocaleString()} <span className="text-[#6b6a6a] font-normal">{round.currency}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#4a4a5a] uppercase tracking-widest font-medium">Applied</div>
          <div className="text-sm font-semibold text-[#e2e0dc] tabular-nums">
            {(round.applicationsCount ?? 0)}<span className="text-[#4a4a5a] font-normal">/{round.maxApplications}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#4a4a5a] uppercase tracking-widest font-medium">Deadline</div>
          <div className={`text-sm font-semibold ${isExpired ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {isExpired ? 'Closed' : `${daysLeft}d left`}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          <span className="text-xs text-[#4a4a5a] font-mono">{round.chain}</span>
        </div>
        <span className="text-xs text-amber-400/60 group-hover:text-amber-400 transition-colors font-medium">
          View Details &rarr;
        </span>
      </div>
    </Link>
  );
}
