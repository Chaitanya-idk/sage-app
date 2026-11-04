import { useState } from 'react';
import { BookOpen, ChevronDown, CloudSun, FlaskConical, Leaf, ShieldCheck, Sprout, TriangleAlert, UserRound } from 'lucide-react';
import type { DiagnoseResponse, Severity } from '../types/sage';

const SEV: Record<Severity, { n: number; cls: string; text: string }> = {
  low: { n: 1, cls: 'bg-moss-500', text: 'text-moss-700' },
  medium: { n: 2, cls: 'bg-wheat-500', text: 'text-wheat-700' },
  high: { n: 3, cls: 'bg-clay-500', text: 'text-clay-700' },
  unknown: { n: 0, cls: 'bg-soil-300', text: 'text-soil-600' },
};

export function PartialState({ title, reasons }: { title: string; reasons: (string | null | undefined)[] }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-dashed border-soil-300 bg-soil-50/70 p-8 text-center">
      <BookOpen className="mx-auto size-10 text-soil-400" />
      <h3 className="mt-3 font-display text-lg font-semibold text-moss-900">{title}</h3>
      {reasons.filter(Boolean).map((r) => <p key={r} className="mx-auto mt-2 max-w-md text-sm text-soil-700">{r}</p>)}
      <p className="mt-3 text-xs text-soil-500">The visual diagnosis is still available in the first tab.</p>
    </div>
  );
}

function List({ icon: Icon, title, items, tone, delay }: { icon: typeof Leaf; title: string; items: string[]; tone: string; delay: number }) {
  return (
    <div style={{ animationDelay: `${delay}ms` }} className="animate-fade-up rounded-xl border border-soil-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2"><span className={`grid size-7 place-items-center rounded-lg ${tone}`}><Icon className="size-4" /></span>
        <h4 className="text-sm font-semibold text-moss-900">{title}</h4></div>
      {items.length ? (
        <ul className="space-y-1.5 text-sm text-moss-950">
          {items.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-soil-400" />{t}</li>)}
        </ul>
      ) : <p className="text-xs text-soil-500">No guidance in the retrieved sources.</p>}
    </div>
  );
}

export default function TreatmentAdvisory({ result }: { result: DiagnoseResponse }) {
  const a = result.advisory;
  const chunks = result.retrieval.chunks;
  const [openId, setOpenId] = useState<string | null>(null);

  if (!a) return <PartialState title="Treatment advisory unavailable" reasons={[result.partial_failure?.retrieval, result.partial_failure?.llm]} />;

  const sev = SEV[a.severity];
  const cited = new Set(a.citations.map((c) => c.chunk_id));
  const jump = (id: string) => {
    setOpenId(id);
    document.getElementById(`chunk-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="space-y-5">
      {a.needs_expert && (
        <div role="alert" className="flex animate-pop gap-3 rounded-2xl border border-clay-500/30 bg-clay-100 p-4 text-clay-700">
          <UserRound className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Consult a local agricultural extension officer</p>
            <p className="mt-0.5 text-sm">{a.expert_reason || 'This case needs expert confirmation before treatment.'}</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <p className="animate-fade-up text-[15px] leading-relaxed text-moss-950">{a.summary}</p>
        <div className="flex gap-3 sm:flex-col">
          <div className="rounded-xl border border-soil-200 bg-white px-4 py-2.5">
            <p className="label">Severity</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex gap-1">{[1, 2, 3].map((i) => (
                <span key={i} style={{ animationDelay: `${i * 120}ms` }}
                  className={`h-2 w-5 origin-left animate-grow rounded-full ${i <= sev.n ? sev.cls : 'bg-soil-100'}`} />
              ))}</div>
              <span className={`text-sm font-semibold capitalize ${sev.text}`}>{a.severity}</span>
            </div>
          </div>
          <div className="rounded-xl border border-soil-200 bg-white px-4 py-2.5">
            <p className="label">Confidence</p>
            <p className="mt-0.5 text-sm font-semibold capitalize text-moss-800">{a.confidence}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <List icon={FlaskConical} title="Chemical" items={a.treatments.chemical} tone="bg-wheat-100 text-wheat-700" delay={80} />
        <List icon={Leaf} title="Organic" items={a.treatments.organic} tone="bg-moss-100 text-moss-700" delay={160} />
        <List icon={Sprout} title="Cultural" items={a.treatments.cultural} tone="bg-soil-100 text-soil-700" delay={240} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <List icon={ShieldCheck} title="Prevention" items={a.prevention} tone="bg-moss-100 text-moss-700" delay={300} />
        <div style={{ animationDelay: '360ms' }} className="animate-fade-up rounded-xl border border-soil-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-wheat-100 text-wheat-700"><CloudSun className="size-4" /></span>
            <h4 className="text-sm font-semibold text-moss-900">Optimal conditions</h4></div>
          <p className="text-sm text-moss-950">{a.optimal_conditions || <span className="text-xs text-soil-500">Not covered by the sources.</span>}</p>
        </div>
      </div>

      {a.citations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Cited</span>
          {a.citations.map((c) => (
            <button key={c.chunk_id} onClick={() => jump(c.chunk_id)}
              className="rounded-full border border-moss-300 bg-moss-50 px-2.5 py-1 text-xs text-moss-800 transition hover:bg-moss-100" title={c.source}>
              {c.source}
            </button>
          ))}
        </div>
      )}

      <section>
        <h4 className="label mb-2 flex items-center gap-2"><BookOpen className="size-3.5" />Retrieved sources ({chunks.length})</h4>
        {result.retrieval.skipped_reason && <p className="text-sm text-soil-600">{result.retrieval.skipped_reason}</p>}
        <ul className="space-y-2">
          {chunks.map((c) => {
            const open = openId === c.id;
            return (
              <li key={c.id} id={`chunk-${c.id}`} className={`rounded-xl border bg-white transition-shadow ${open ? 'border-moss-400 shadow-md' : 'border-soil-200'}`}>
                <button onClick={() => setOpenId(open ? null : c.id)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                  <span className="w-12 shrink-0">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-soil-100"><span className="block h-full rounded-full bg-moss-500" style={{ width: `${Math.max(0, c.score) * 100}%` }} /></span>
                    <span className="font-mono text-[10px] text-soil-500">{c.score.toFixed(2)}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-moss-900">{c.source}</span>
                  {cited.has(c.id) && <span className="rounded-full bg-moss-100 px-2 py-0.5 text-[10px] font-medium text-moss-700">cited</span>}
                  <ChevronDown className={`size-4 shrink-0 text-soil-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                </button>
                <div className={`grid transition-[grid-template-rows] duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <p className="overflow-hidden whitespace-pre-wrap px-4 text-sm leading-relaxed text-soil-800 [&:not(:empty)]:pb-3">{c.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="flex items-start gap-2 text-xs text-soil-600">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        SAGE gives recommendations only. Confirm product choice and dosage with a local agricultural extension officer before applying any treatment.
      </p>
    </div>
  );
}
