import { useState } from 'react';
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';

export default function AdvancedSettings({ prompt, defaultPrompt, temperature, maxTokens, onPrompt, onTemperature, onMaxTokens, disabled }: {
  prompt: string; defaultPrompt: string; temperature: number; maxTokens: number;
  onPrompt: (v: string) => void; onTemperature: (v: number) => void; onMaxTokens: (v: number) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border border-soil-200 bg-soil-50/50">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="adv-panel"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-soil-800">
        <SlidersHorizontal className="size-4 text-soil-500" /> Advanced settings
        <ChevronDown className={`ml-auto size-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id="adv-panel" className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-3 px-3 pb-3">
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-xs text-soil-700">
                Prompt
                {prompt !== defaultPrompt && (
                  <button type="button" onClick={() => onPrompt(defaultPrompt)} className="inline-flex items-center gap-1 text-moss-700 hover:underline">
                    <RotateCcw className="size-3" /> reset to default
                  </button>
                )}
              </span>
              <textarea className="field min-h-24 font-mono text-xs" disabled={disabled} value={prompt} onChange={(e) => onPrompt(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 flex justify-between text-xs text-soil-700">Temperature <b className="font-mono text-moss-700">{temperature.toFixed(1)}</b></span>
                <input type="range" min={0} max={1} step={0.1} value={temperature} disabled={disabled}
                  onChange={(e) => onTemperature(Number(e.target.value))} className="w-full accent-moss-600" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-soil-700">Max new tokens</span>
                <input type="number" min={16} max={2048} step={16} value={maxTokens} disabled={disabled} className="field"
                  onChange={(e) => onMaxTokens(Math.max(16, Math.min(2048, Number(e.target.value) || 256)))} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
