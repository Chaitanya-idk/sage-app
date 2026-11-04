import { BookOpen, Check, PenLine, ScanLine } from 'lucide-react';

// The middleware returns once at the end, so stages advance on typical timings (estimates).
const STAGES = [
  { label: 'Analyzing image', hint: 'Qwen2.5-VL + crop adapter on the GPU', icon: ScanLine, until: 30 },
  { label: 'Retrieving knowledge', hint: 'Searching the agronomy knowledge base', icon: BookOpen, until: 40 },
  { label: 'Writing advisory', hint: 'Grounding treatments in retrieved sources', icon: PenLine, until: Infinity },
];

export default function RunProgress({ elapsed }: { elapsed: number }) {
  const current = STAGES.findIndex((s) => elapsed < s.until);
  return (
    <div className="card animate-fade-up p-6 sm:p-8" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold text-moss-900">Diagnosing…</h2>
        <span className="font-mono text-2xl tabular-nums text-moss-700">{elapsed.toFixed(0)}s</span>
      </div>
      <p className="mt-1 text-sm text-soil-600">The first request for a crop loads its adapter and can take a minute or more.</p>

      <ol className="mt-6 space-y-3">
        {STAGES.map((s, i) => {
          const done = i < current, active = i === current;
          const Icon = done ? Check : s.icon;
          return (
            <li key={s.label} className={`relative flex items-center gap-4 overflow-hidden rounded-xl border p-3 transition-all duration-500
              ${active ? 'border-moss-300 bg-moss-50 shadow-sm' : done ? 'border-moss-200 bg-white' : 'border-soil-200 bg-white/60 opacity-60'}`}>
              {active && <div className="shimmer absolute inset-0" />}
              <span className={`relative grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-500
                ${done ? 'bg-moss-500 text-white' : active ? 'bg-moss-600 text-white' : 'bg-soil-100 text-soil-500'}`}>
                <Icon className={`size-4 ${active ? 'animate-pulse' : ''}`} />
              </span>
              <div className="relative">
                <p className="text-sm font-medium text-moss-950">{s.label}</p>
                <p className="text-xs text-soil-600">{s.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
