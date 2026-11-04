import { useCallback, useEffect, useRef, useState } from 'react';
import { Leaf, LoaderCircle, ScanSearch, Sprout, TriangleAlert, Wheat } from 'lucide-react';
import AdvancedSettings from './components/AdvancedSettings';
import CropSelector from './components/CropSelector';
import FarmContextForm from './components/FarmContextForm';
import Header from './components/Header';
import ImageDropzone from './components/ImageDropzone';
import ResultsDashboard from './components/ResultsDashboard';
import RunProgress from './components/RunProgress';
import { Toasts, useToasts } from './components/Toasts';
import { api } from './services/api';
import type { CropDetail, DiagnoseResponse, FarmContext, HealthResponse } from './types/sage';

const FALLBACK: CropDetail[] = ['corn', 'rice', 'soybean', 'tomato', 'wheat'].map((id) => ({
  crop_id: id, display_name: id[0].toUpperCase() + id.slice(1), hf_repo: '', checkpoint_subpath: '', model_type: '',
  adapter_name: '', default_prompt: '', loading_status: '', classes_count: 0, known_classes: [],
}));

export default function App() {
  const { toasts, push, dismiss } = useToasts();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [crops, setCrops] = useState<CropDetail[]>([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [crop, setCrop] = useState('tomato');
  const [image, setImage] = useState<File | null>(null);
  const [farm, setFarm] = useState<FarmContext>({});
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0);
  const [maxTokens, setMaxTokens] = useState(256);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [runId, setRunId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try { setHealth(await api.health()); setHealthErr(null); }
    catch (e) { setHealthErr((e as Error).message); }
    finally { setChecking(false); }
  }, []);

  const loadCrops = useCallback(async () => {
    setCropsLoading(true);
    try {
      const r = await api.crops();
      setCrops(r.crop_details.length ? r.crop_details : FALLBACK);
    } catch (e) {
      setCrops((c) => (c.length ? c : FALLBACK));
      push('info', `Crop details unavailable (${(e as Error).message}). Using the default crop list.`);
    } finally { setCropsLoading(false); }
  }, [push]);

  useEffect(() => {
    checkHealth();
    loadCrops();
    const id = setInterval(checkHealth, 30_000);
    return () => clearInterval(id);
  }, [checkHealth, loadCrops]);

  const detail = crops.find((c) => c.crop_id === crop);
  const defaultPrompt = detail?.default_prompt ?? '';
  useEffect(() => setPrompt(defaultPrompt), [crop, defaultPrompt]);

  useEffect(() => {
    if (!running) return;
    const t0 = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - t0) / 1000), 200);
    return () => clearInterval(id);
  }, [running]);

  const backendDown = !!healthErr || health?.backend.status === 'down';

  const diagnose = async () => {
    if (!image || running) return;
    setRunning(true); setElapsed(0); setError(null);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    try {
      const r = await api.diagnose({ crop, image, prompt: prompt !== defaultPrompt ? prompt : undefined, max_new_tokens: maxTokens, temperature, farm });
      setResult(r); setRunId((n) => n + 1);
      if (r.partial_failure) push('info', 'Diagnosis complete, but the advisory is partially unavailable.');
      else push('success', `Diagnosis complete in ${r.timings.total_s.toFixed(1)} s.`);
    } catch (e) {
      const m = (e as Error).message;
      setError(m); push('error', m);
    } finally {
      setRunning(false);
      checkHealth();
    }
  };

  return (
    <div className="min-h-dvh">
      <Header health={health} error={healthErr} checking={checking} onRefresh={checkHealth} />

      {backendDown && (
        <div role="alert" className="animate-fade-in border-b border-clay-500/30 bg-clay-100 text-clay-700">
          <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>{healthErr
              ? <><b>Middleware unreachable.</b> {healthErr}</>
              : <><b>Backend offline</b> — restart the Kaggle notebook and update <code className="rounded bg-white/60 px-1">BACKEND_URL</code> in middleware/.env.</>}</p>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:py-8">
        <aside className="card h-fit animate-fade-up space-y-6 p-5 lg:sticky lg:top-24">
          <CropSelector crops={crops} loading={cropsLoading} value={crop} onChange={setCrop} disabled={running} />
          <ImageDropzone file={image} onChange={setImage} onError={(m) => push('error', m)} scanning={running} disabled={running} />
          <FarmContextForm value={farm} onChange={setFarm} disabled={running} />
          <AdvancedSettings prompt={prompt} defaultPrompt={defaultPrompt} temperature={temperature} maxTokens={maxTokens}
            onPrompt={setPrompt} onTemperature={setTemperature} onMaxTokens={setMaxTokens} disabled={running} />

          <button onClick={diagnose} disabled={!image || running}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-moss-600 to-moss-700 px-4 py-3.5 font-semibold text-white shadow-lg shadow-moss-700/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-moss-700/30 active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:from-soil-300 disabled:to-soil-400 disabled:shadow-none">
            {running && <span className="shimmer absolute inset-0" />}
            {running ? <LoaderCircle className="size-5 animate-spin" /> : <ScanSearch className="size-5 transition-transform group-hover:scale-110" />}
            <span className="relative">{running ? `Diagnosing… ${elapsed.toFixed(0)}s` : 'Diagnose Crop'}</span>
          </button>
          {!image && <p className="-mt-3 text-center text-xs text-soil-500">Upload a leaf image to begin.</p>}
        </aside>

        <section ref={resultsRef} aria-label="Results" className="min-w-0 scroll-mt-24">
          {running ? (
            <RunProgress elapsed={elapsed} />
          ) : error && !result ? (
            <div role="alert" className="card animate-fade-up p-8 text-center">
              <TriangleAlert className="mx-auto size-10 text-clay-500" />
              <h2 className="mt-3 font-display text-xl font-semibold text-moss-900">Diagnosis failed</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-soil-700">{error}</p>
              <button onClick={diagnose} disabled={!image} className="mt-5 rounded-xl bg-moss-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-moss-700">Try again</button>
            </div>
          ) : result ? (
            <div className="space-y-3">
              {error && <p role="alert" className="animate-fade-in rounded-xl bg-clay-100 px-4 py-2 text-sm text-clay-700">Latest run failed: {error} Showing the previous result.</p>}
              <ResultsDashboard key={runId} result={result} onError={(m) => push('error', m)} />
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      </main>

      <footer className="pb-8 text-center text-xs text-soil-500">
        SAGE · Qwen2.5-VL with per-crop LoRA adapters · Recommendations only, not a substitute for expert advice
      </footer>
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function EmptyState() {
  const steps = [
    ['Pick a crop', 'Corn, rice, soybean, tomato or wheat'],
    ['Upload a leaf photo', 'Clear, close-up, natural light works best'],
    ['Get a grounded advisory', 'Diagnosis, treatments with sources, and a follow-up chat'],
  ];
  return (
    <div className="card relative animate-fade-up overflow-hidden p-8 sm:p-12">
      <Leaf className="absolute -right-8 -top-8 size-48 animate-float text-moss-200/60" aria-hidden />
      <Wheat className="absolute -bottom-10 right-24 size-40 animate-float text-wheat-300/40 [animation-delay:-3s]" aria-hidden />
      <div className="relative max-w-lg">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-moss-100 px-3 py-1 text-xs font-medium text-moss-700">
          <Sprout className="size-3.5" /> Visual plant disease diagnosis
        </span>
        <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-moss-900 sm:text-4xl">
          See what your crop is telling you.
        </h2>
        <p className="mt-3 text-soil-700">SAGE identifies plant diseases from a single photo, then builds treatment advice from an agronomy knowledge base.</p>
        <ol className="mt-8 space-y-4">
          {steps.map(([t, d], i) => (
            <li key={t} style={{ animationDelay: `${150 + i * 120}ms` }} className="flex animate-fade-up items-start gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-moss-600 font-display font-bold text-white">{i + 1}</span>
              <div><p className="font-medium text-moss-900">{t}</p><p className="text-sm text-soil-600">{d}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
