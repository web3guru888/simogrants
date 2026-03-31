interface AllocationBarProps {
  amount: number;
  total: number;
  label: string;
  color?: string;
}

export function AllocationBar({ amount, total, label, color = 'from-amber-500 to-amber-400' }: AllocationBarProps) {
  const pct = total > 0 ? (amount / total) * 100 : 0;

  return (
    <div className="w-full" role="meter" aria-valuenow={amount} aria-valuemin={0} aria-valuemax={total} aria-label={label}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[#8a8a9a] truncate mr-2">{label}</span>
        <span className="text-xs font-semibold text-[#e2e0dc] whitespace-nowrap tabular-nums">
          {amount.toLocaleString()} <span className="text-[#6b6a6a]">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
