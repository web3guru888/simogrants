interface ScoreBarProps {
  score: number;
  maxScore?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'violet' | 'blue' | 'cyan' | 'emerald' | 'amber';
}

const colorMap = {
  violet: 'from-violet-500 to-violet-400',
  blue: 'from-teal-500 to-teal-400',
  cyan: 'from-teal-500 to-teal-400',
  emerald: 'from-emerald-500 to-emerald-400',
  amber: 'from-amber-500 to-amber-400',
};

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
};

export function ScoreBar({ score, maxScore = 100, label, showValue = true, size = 'md', color = 'amber' }: ScoreBarProps) {
  const pct = Math.min(100, (score / maxScore) * 100);
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'text-teal-400';
    if (s >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="w-full" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={maxScore} aria-label={label || 'Score'}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs text-[#6b6a6a]">{label}</span>}
          {showValue && <span className={`text-xs font-bold tabular-nums ${getScoreColor(score)}`}>{score.toFixed(1)}</span>}
        </div>
      )}
      <div className={`w-full bg-white/[0.06] rounded-full ${sizeMap[size]} overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorMap[color]} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
