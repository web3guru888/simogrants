interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  accepting: { label: 'Accepting', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  evaluating: { label: 'Evaluating', classes: 'bg-teal-500/15 text-teal-400 border-teal-500/25' },
  funded: { label: 'Funded', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  closed: { label: 'Closed', classes: 'bg-white/[0.06] text-[#6b6a6a] border-white/[0.08]' },
  submitted: { label: 'Submitted', classes: 'bg-teal-500/15 text-teal-400 border-teal-500/25' },
  evaluated: { label: 'Evaluated', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  rejected: { label: 'Rejected', classes: 'bg-red-500/15 text-red-400 border-red-500/25' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, classes: 'bg-white/[0.06] text-[#6b6a6a] border-white/[0.08]' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.classes}`}>
      {config.label}
    </span>
  );
}
