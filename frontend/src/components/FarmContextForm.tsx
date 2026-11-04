import type { FarmContext } from '../types/sage';

const FIELDS: { key: keyof FarmContext; label: string; options: string[] }[] = [
  { key: 'growth_stage', label: 'Growth stage', options: ['Seedling', 'Vegetative', 'Flowering', 'Fruiting / grain fill', 'Maturity / harvest'] },
  { key: 'soil_hydration', label: 'Soil hydration', options: ['Dry', 'Moist', 'Wet / waterlogged', 'Recently irrigated'] },
  { key: 'recent_weather', label: 'Recent weather', options: ['Hot & dry', 'Warm & humid', 'Heavy rain', 'Cool & wet', 'Mild / normal'] },
  { key: 'past_treatments', label: 'Past treatments', options: ['None', 'Fungicide', 'Insecticide', 'Bactericide', 'Organic treatment', 'Fertilizer only'] },
];

export default function FarmContextForm({ value, onChange, disabled }: {
  value: FarmContext; onChange: (v: FarmContext) => void; disabled?: boolean;
}) {
  const set = (k: keyof FarmContext, v: string) => onChange({ ...value, [k]: v || undefined });
  return (
    <section aria-labelledby="farm-label">
      <h2 id="farm-label" className="label mb-2">3 · Farm context <span className="normal-case tracking-normal text-soil-400">(optional)</span></h2>
      <div className="grid grid-cols-2 gap-2.5">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs text-soil-700">{f.label}</span>
            <select className="field cursor-pointer" disabled={disabled} value={value[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">Not specified</option>
              {f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
        ))}
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs text-soil-700">Notes</span>
          <textarea className="field min-h-16 resize-y" disabled={disabled} maxLength={500} value={value.notes ?? ''}
            placeholder="e.g. spots appeared after last week's rain, spreading upward"
            onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>
    </section>
  );
}
