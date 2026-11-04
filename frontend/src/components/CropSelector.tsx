import type { CropDetail } from '../types/sage';

const EMOJI: Record<string, string> = { corn: '🌽', rice: '🌾', soybean: '🫘', tomato: '🍅', wheat: '🌿' };

export default function CropSelector({ crops, loading, value, onChange, disabled }: {
  crops: CropDetail[]; loading: boolean; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const active = crops.find((c) => c.crop_id === value);

  return (
    <section aria-labelledby="crop-label">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="crop-label" className="label">1 · Crop</h2>
        {active?.loading_status && (
          <span className="rounded-full bg-moss-100 px-2 py-0.5 text-[10px] font-medium text-moss-700">{active.loading_status}</span>
        )}
      </div>

      <div role="radiogroup" aria-labelledby="crop-label" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {loading && !crops.length
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="relative h-[76px] overflow-hidden rounded-xl bg-soil-100"><div className="shimmer absolute inset-0" /></div>
            ))
          : crops.map((c, i) => {
              const on = c.crop_id === value;
              return (
                <button key={c.crop_id} role="radio" aria-checked={on} disabled={disabled}
                  onClick={() => onChange(c.crop_id)} style={{ animationDelay: `${i * 50}ms` }}
                  className={`group flex animate-pop flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-xs font-medium transition-all duration-300 disabled:cursor-not-allowed
                    ${on ? 'scale-[1.03] border-moss-500 bg-moss-50 text-moss-800 shadow-md shadow-moss-500/15 ring-2 ring-moss-500/25'
                         : 'border-soil-200 bg-white text-soil-700 hover:-translate-y-0.5 hover:border-moss-300 hover:shadow-sm'}`}>
                  <span className={`text-2xl transition-transform duration-300 ${on ? 'scale-110' : 'group-hover:scale-110'}`} aria-hidden>
                    {EMOJI[c.crop_id] ?? '🌱'}
                  </span>
                  <span className="w-full text-center leading-tight">{c.display_name}</span>
                </button>
              );
            })}
      </div>

      {active && active.known_classes.length > 0 && (
        <div key={active.crop_id} className="mt-3">
          <p className="mb-1.5 text-[11px] text-soil-600">{active.classes_count} known conditions</p>
          <ul className="flex flex-wrap gap-1.5">
            {active.known_classes.map((k, i) => (
              <li key={k} style={{ animationDelay: `${i * 25}ms` }}
                className={`animate-fade-up rounded-full border px-2.5 py-0.5 text-[11px] ${/healthy/i.test(k)
                  ? 'border-moss-200 bg-moss-50 text-moss-700' : 'border-soil-200 bg-soil-50 text-soil-700'}`}>
                {k}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
