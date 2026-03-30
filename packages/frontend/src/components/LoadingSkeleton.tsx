export function LoadingSkeleton({ type = 'card' }: { type?: 'card' | 'text' | 'table' | 'page' }) {
  if (type === 'page') {
    return (
      <div className="animate-pulse space-y-6 p-6">
        <div className="h-8 w-48 bg-slate-700/50 rounded-lg" />
        <div className="h-4 w-96 bg-slate-700/50 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-800/50 rounded-xl border border-slate-700/50" />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-slate-800/50 rounded-lg border border-slate-700/50" />
        ))}
      </div>
    );
  }

  if (type === 'text') {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-slate-700/50 rounded w-3/4" />
        <div className="h-4 bg-slate-700/50 rounded w-1/2" />
        <div className="h-4 bg-slate-700/50 rounded w-5/6" />
      </div>
    );
  }

  // card
  return (
    <div className="animate-pulse rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
      <div className="h-5 bg-slate-700/50 rounded w-2/3 mb-3" />
      <div className="h-4 bg-slate-700/50 rounded w-full mb-2" />
      <div className="h-4 bg-slate-700/50 rounded w-3/4 mb-4" />
      <div className="flex gap-3">
        <div className="h-8 bg-slate-700/50 rounded w-20" />
        <div className="h-8 bg-slate-700/50 rounded w-20" />
        <div className="h-8 bg-slate-700/50 rounded w-20" />
      </div>
    </div>
  );
}
