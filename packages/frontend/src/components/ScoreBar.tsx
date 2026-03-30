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
  blue: 'from-blue-500 to-blue-400',
  cyan: 'from-cyan-500 to-cyan-400',
  emerald: 'from-emerald-500 to-emerald-400',
  amber: 'from-amber-500 to-amber-400',
};

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function ScoreBar({ score, maxScore = 100, label, showValue = true, size = 'md', color = 'violet' }: ScoreBarProps) {
  const pct = Math.min(100, (score / maxScore) * 100);
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'text-blue-400';
    if (s >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-slate-400">{label}</span>}
          {showValue && <span className={`text-xs font-bold ${getScoreColor(score)}`}>{score.toFixed(1)}</span>}
        </div>
      )}
      <div className={`w-full bg-slate-700/50 rounded-full ${sizeMap[size]} overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorMap[color]} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
