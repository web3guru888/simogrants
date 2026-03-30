interface AllocationBarProps {
  amount: number;
  total: number;
  label: string;
  color?: string;
}

export function AllocationBar({ amount, total, label, color = 'from-violet-500 to-cyan-500' }: AllocationBarProps) {
  const pct = total > 0 ? (amount / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400 truncate mr-2">{label}</span>
        <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
          {amount.toLocaleString()} USDC ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
