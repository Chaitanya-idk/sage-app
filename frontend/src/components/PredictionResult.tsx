import { useState } from 'react';
import { Bug, ChevronDown, CircleCheck, Eye, FileJson, Leaf, Microscope, Timer, TriangleAlert } from 'lucide-react';
import type { DiagnoseResponse } from '../types/sage';

function Field({ icon: Icon, label, value, italic, delay }: {
  icon: typeof Leaf; label: string; value?: string | null; italic?: boolean; delay: number;
}) {
  return (
    <div style={{ animationDelay: `${delay}ms` }} className="min-w-0 animate-fade-up rounded-xl border border-soil-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2 text-soil-600"><Icon className="size-4" /><span className="label">{label}</span></div>
      <p className={`mt-1.5 break-words text-sm leading-relaxed text-moss-950 ${italic ? 'italic' : ''}`}>{value || <span className="text-soil-400 not-italic">Not reported</span>}</p>
    </div>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-soil-200 bg-white">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-soil-800">
        <FileJson className="size-4 text-soil-500" />{title}
        <ChevronDown className={`ml-auto size-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

export default function PredictionResult({ result }: { result: DiagnoseResponse }) {
  const r = result.prediction;
  const p = r.prediction;
  const name = p.class_name ?? 'Unidentified';
  const healthy = /healthy/i.test(name);
  const meta = r.image_metadata;

  const telemetry = [
    ['Inference', `${r.inference_time_seconds.toFixed(2)} s`],
    ['Round trip', `${result.timings.total_s.toFixed(1)} s`],
    ['Adapter', r.active_adapter],
    ['Checkpoint', r.checkpoint],
    ['Image', meta ? `${meta.width ?? '?'}×${meta.height ?? '?'} ${meta.format ?? ''}` : '—'],
  ];

  return (
    <div className="space-y-5">
      <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${healthy
        ? 'bg-gradient-to-br from-moss-500 to-moss-700' : 'bg-gradient-to-br from-wheat-500 via-soil-600 to-clay-700'}`}>
        <Leaf className="absolute -right-6 -top-6 size-40 animate-float opacity-15" aria-hidden />
        <p className="text-xs uppercase tracking-[0.2em] opacity-80">{r.crop} · diagnosis</p>
        <h3 className="mt-1 animate-pop break-words font-display text-2xl font-bold sm:text-4xl">{name}</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
            {healthy ? <CircleCheck className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
            {healthy ? 'Healthy plant' : 'Disease detected'}
          </span>
          {p.is_canonical_match != null && (
            <span className={`rounded-full px-2.5 py-1 backdrop-blur ${p.is_canonical_match ? 'bg-white/20' : 'bg-black/25 ring-1 ring-white/40'}`}>
              {p.is_canonical_match ? '✓ Canonical taxonomy match' : '⚠ Not a canonical class'}
            </span>
          )}
          {p.matched_taxonomy_class && p.matched_taxonomy_class !== name && (
            <span className="max-w-full truncate rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">≈ {p.matched_taxonomy_class}</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field icon={Bug} label="Disease type" value={p.disease_type} delay={60} />
        <Field icon={Leaf} label="Plant organ" value={p.plant_organ} delay={120} />
        <Field icon={Microscope} label="Pathogen" value={p.pathogen} italic delay={180} />
        <Field icon={Eye} label="Visual symptoms" value={p.visual_symptoms} delay={240} />
      </div>

      <div className="animate-fade-up rounded-xl border border-soil-200 bg-soil-50/70 p-4" style={{ animationDelay: '300ms' }}>
        <div className="mb-3 flex items-center gap-2 text-soil-600"><Timer className="size-4" /><span className="label">Telemetry</span></div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {telemetry.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-soil-500">{k}</dt>
              <dd className="truncate font-mono text-xs text-moss-900" title={v}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Collapsible title="Raw model output">
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-soil-100 p-4 font-mono text-xs text-moss-900">{r.raw_output}</pre>
      </Collapsible>
      <Collapsible title="Full JSON response">
        <pre className="max-h-96 overflow-auto border-t border-soil-100 bg-moss-950 p-4 font-mono text-[11px] text-moss-100">{JSON.stringify(r, null, 2)}</pre>
      </Collapsible>
    </div>
  );
}
