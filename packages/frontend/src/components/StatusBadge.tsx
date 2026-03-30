interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  accepting: { label: 'Accepting', classes: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  evaluating: { label: 'Evaluating', classes: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  funded: { label: 'Funded', classes: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  closed: { label: 'Closed', classes: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  submitted: { label: 'Submitted', classes: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  evaluated: { label: 'Evaluated', classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  rejected: { label: 'Rejected', classes: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, classes: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.classes}`}>
      {config.label}
    </span>
  );
}
