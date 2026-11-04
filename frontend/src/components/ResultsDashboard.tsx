import { useRef, useState } from 'react';
import { Bot, Microscope, Stethoscope, TriangleAlert } from 'lucide-react';
import type { DiagnoseResponse } from '../types/sage';
import AgronomistChat from './AgronomistChat';
import PredictionResult from './PredictionResult';
import TreatmentAdvisory from './TreatmentAdvisory';

const TABS = [
  { id: 'diagnosis', label: 'Visual Diagnosis', short: 'Diagnosis', icon: Microscope },
  { id: 'treatment', label: 'Treatment & Knowledge', short: 'Treatment', icon: Stethoscope },
  { id: 'chat', label: 'AI Agronomist', short: 'Agronomist', icon: Bot },
];

export default function ResultsDashboard({ result, onError }: { result: DiagnoseResponse; onError: (m: string) => void }) {
  const [tab, setTab] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const partial = result.partial_failure;

  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const next = (tab + d + TABS.length) % TABS.length;
    setTab(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="card animate-fade-up overflow-hidden">
      <div role="tablist" aria-label="Results" onKeyDown={onKey} className="relative flex border-b border-soil-200 bg-soil-50/60">
        {TABS.map((t, i) => {
          const warn = i > 0 && partial;
          return (
            <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" id={`tab-${t.id}`} aria-selected={tab === i}
              aria-controls={`panel-${t.id}`} tabIndex={tab === i ? 0 : -1} onClick={() => setTab(i)}
              className={`relative flex flex-1 items-center justify-center gap-2 px-2 py-3.5 text-sm font-medium transition-colors ${tab === i ? 'text-moss-800' : 'text-soil-600 hover:text-moss-700'}`}>
              <t.icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.short}</span>
              {warn && <TriangleAlert className="size-3.5 text-wheat-500" aria-label="partially unavailable" />}
            </button>
          );
        })}
        <span className="absolute bottom-0 h-0.5 rounded-full bg-moss-600 transition-all duration-300 ease-out"
          style={{ width: `${100 / TABS.length}%`, left: `${(100 / TABS.length) * tab}%` }} />
      </div>

      {TABS.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={tab !== i}
          className="animate-fade-in p-4 sm:p-6">
          {i === 0 && <PredictionResult result={result} />}
          {i === 1 && <TreatmentAdvisory result={result} />}
          {i === 2 && <AgronomistChat result={result} onError={onError} />}
        </div>
      ))}
    </div>
  );
}
