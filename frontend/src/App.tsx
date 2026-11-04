import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Leaf, LoaderCircle, RefreshCw, ScanSearch, Sprout, TriangleAlert, Wheat } from 'lucide-react';
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

type View = 'input' | 'diagnosis';
const viewFromHash = (): View => (window.location.hash === '#/diagnosis' ? 'diagnosis' : 'input');

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

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

  const [view, setView] = useState<View>(viewFromHash);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [runImage, setRunImage] = useState<File | null>(null);
  const [runId, setRunId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const runImageUrl = useObjectUrl(runImage);
  const busyRef = useRef(false);

  const go = useCallback((v: View) => {
    window.location.hash = v === 'diagnosis' ? '/diagnosis' : '/';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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
    if (!image || busyRef.current) return;
    busyRef.current = true;
    setRunning(true); setElapsed(0); setError(null); setRunImage(image);
    go('diagnosis');
    try {
      const r = await api.diagnose({ crop, image, prompt: prompt !== defaultPrompt ? prompt : undefined, max_new_tokens: maxTokens, temperature, farm });
      setResult(r); setRunId((n) => n + 1);
      if (r.partial_failure) push('info', 'Diagnosis complete, but the advisory is partially unavailable.');
      else push('success', `Diagnosis complete in ${r.timings.total_s.toFixed(1)} s.`);
    } catch (e) {
      const m = (e as Error).message;
      setError(m); push('error', m);
    } finally {
      busyRef.current = false;
      setRunning(false);
      checkHealth();
    }
  };

  const showDiagnosis = view === 'diagnosis' && (running || result || error);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header health={health} error={healthErr} checking={checking} onRefresh={checkHealth} />

      {backendDown && (
        <div role="alert" className="animate-fade-in border-b border-clay-500/30 bg-clay-100 text-clay-700">
          <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p className="min-w-0">{healthErr
              ? <><b>Middleware unreachable.</b> {healthErr}</>
              : <><b>Backend offline</b> — restart the Kaggle notebook and update <code className="rounded bg-white/60 px-1">BACKEND_URL</code> in middleware/.env.</>}</p>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:py-10">
        {showDiagnosis ? (
          <DiagnosisView
            key="diagnosis" running={running} elapsed={elapsed} result={result} error={error} runId={runId}
            imageUrl={runImageUrl} cropName={crops.find((c) => c.crop_id === (result?.prediction.crop ?? crop))?.display_name ?? crop}
            farm={result?.farm_context ?? (farm as Record<string, string>)}
            onBack={() => go('input')} onRetry={diagnose} canRetry={!!image} onError={(m) => push('error', m)}
          />
        ) : (
          <div key="input" className="animate-fade-up space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-moss-100 px-3 py-1 text-xs font-medium text-moss-700">
                  <Sprout className="size-3.5" /> Visual plant disease diagnosis
                </span>
                <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-moss-900 sm:text-4xl">See what your crop is telling you.</h2>
                <p className="mt-2 max-w-2xl text-soil-700">Choose the crop, add a clear photo of the affected leaf, and SAGE returns a diagnosis with grounded treatment advice.</p>
              </div>
              {result && !running && (
                <button onClick={() => go('diagnosis')}
                  className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-moss-300 bg-white px-4 py-2 text-sm font-medium text-moss-800 transition hover:bg-moss-50 sm:self-auto">
                  View last diagnosis <ArrowRight className="size-4" />
                </button>
              )}
            </div>

            <div className="card relative overflow-hidden p-5 sm:p-7 lg:p-8">
              <Leaf className="pointer-events-none absolute -right-10 -top-10 size-44 animate-float text-moss-200/40" aria-hidden />
              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-6">
                  <CropSelector crops={crops} loading={cropsLoading} value={crop} onChange={setCrop} />
                  <ImageDropzone file={image} onChange={setImage} onError={(m) => push('error', m)} />
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                  <FarmContextForm value={farm} onChange={setFarm} />
                  <AdvancedSettings prompt={prompt} defaultPrompt={defaultPrompt} temperature={temperature} maxTokens={maxTokens}
                    onPrompt={setPrompt} onTemperature={setTemperature} onMaxTokens={setMaxTokens} />
                  <div className="mt-auto space-y-2 pt-2">
                    <button onClick={diagnose} disabled={!image || running}
                      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-moss-600 to-moss-700 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-moss-700/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-moss-700/30 active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:from-soil-300 disabled:to-soil-400 disabled:shadow-none">
                      {running ? <LoaderCircle className="size-5 animate-spin" /> : <ScanSearch className="size-5 transition-transform group-hover:scale-110" />}
                      {running ? 'Diagnosing…' : 'Diagnose Crop'}
                      {!running && image && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
                    </button>
                    <p className="text-center text-xs text-soil-500">
                      {image ? 'The first request for a crop loads its model adapter and can take a minute.' : 'Upload a leaf image to begin.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <ol className="grid gap-3 sm:grid-cols-3">
              {[['Pick a crop', 'Corn, rice, soybean, tomato or wheat'], ['Upload a leaf photo', 'Close-up, in focus, natural light'],
                ['Get grounded advice', 'Diagnosis, treatments and a follow-up chat']].map(([t, d], i) => (
                <li key={t} style={{ animationDelay: `${150 + i * 100}ms` }} className="flex min-w-0 animate-fade-up items-start gap-3 rounded-xl border border-soil-200/70 bg-white/60 p-4">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-moss-600 font-display text-sm font-bold text-white">{i + 1}</span>
                  <div className="min-w-0"><p className="text-sm font-medium text-moss-900">{t}</p><p className="text-xs text-soil-600">{d}</p></div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>

      <footer className="pb-8 text-center text-xs text-soil-500">
        SAGE · Qwen2.5-VL with per-crop LoRA adapters · Recommendations only, not a substitute for expert advice
      </footer>
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function DiagnosisView({ running, elapsed, result, error, runId, imageUrl, cropName, farm, onBack, onRetry, canRetry, onError }: {
  running: boolean; elapsed: number; result: DiagnoseResponse | null; error: string | null; runId: number;
  imageUrl: string | null; cropName: string; farm: Record<string, string>;
  onBack: () => void; onRetry: () => void; canRetry: boolean; onError: (m: string) => void;
}) {
  const ctx = Object.entries(farm).filter(([, v]) => v);
  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} disabled={running}
          className="inline-flex items-center gap-2 rounded-xl border border-soil-200 bg-white px-3.5 py-2 text-sm font-medium text-soil-800 transition hover:-translate-x-0.5 hover:border-moss-300 hover:text-moss-800 disabled:opacity-50">
          <ArrowLeft className="size-4" /> New diagnosis
        </button>
        <h2 className="min-w-0 font-display text-2xl font-bold text-moss-900">Diagnosis report</h2>
        {!running && canRetry && (
          <button onClick={onRetry} className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-moss-700 transition hover:bg-moss-50">
            <RefreshCw className="size-4" /> Re-run
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="card h-fit min-w-0 overflow-hidden lg:sticky lg:top-28">
          {imageUrl ? (
            <div className="relative bg-moss-950">
              <img src={imageUrl} alt="Diagnosed leaf" className="h-56 w-full object-contain lg:h-64" />
              {running && (
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-0 bg-[linear-gradient(rgb(119_168_82/0.12)_1px,transparent_1px),linear-gradient(90deg,rgb(119_168_82/0.12)_1px,transparent_1px)] bg-[size:24px_24px]" />
                  <div className="absolute inset-x-0 h-[3px] animate-scan bg-moss-300 shadow-[0_0_24px_6px_rgb(159_196_127/0.7)]" />
                </div>
              )}
            </div>
          ) : <div className="grid h-40 place-items-center bg-soil-100"><Wheat className="size-10 text-soil-300" /></div>}
          <dl className="space-y-3 p-4 text-sm">
            <div><dt className="label">Crop</dt><dd className="mt-0.5 font-medium text-moss-900">{cropName}</dd></div>
            {ctx.length > 0 && (
              <div>
                <dt className="label">Farm context</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {ctx.map(([k, v]) => (
                    <span key={k} title={k.replace(/_/g, ' ')} className="max-w-full rounded-full bg-soil-100 px-2.5 py-0.5 text-xs text-soil-800">{v}</span>
                  ))}
                </dd>
              </div>
            )}
            {result && !running && (
              <div>
                <dt className="label">Timings</dt>
                <dd className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-xs text-soil-700">
                  <span>Inference</span><span className="text-right">{result.timings.inference_s.toFixed(1)}s</span>
                  <span>Retrieval</span><span className="text-right">{result.timings.retrieval_s.toFixed(1)}s</span>
                  <span>Advisory</span><span className="text-right">{result.timings.llm_s.toFixed(1)}s</span>
                  <span className="font-semibold">Total</span><span className="text-right font-semibold">{result.timings.total_s.toFixed(1)}s</span>
                </dd>
              </div>
            )}
          </dl>
        </aside>

        <section aria-label="Results" className="min-w-0">
          {running ? (
            <RunProgress elapsed={elapsed} />
          ) : error && !result ? (
            <div role="alert" className="card animate-fade-up p-8 text-center">
              <TriangleAlert className="mx-auto size-10 text-clay-500" />
              <h3 className="mt-3 font-display text-xl font-semibold text-moss-900">Diagnosis failed</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-soil-700">{error}</p>
              <div className="mt-5 flex justify-center gap-2">
                <button onClick={onBack} className="rounded-xl border border-soil-200 px-4 py-2 text-sm font-medium text-soil-800 transition hover:bg-soil-50">Back</button>
                {canRetry && <button onClick={onRetry} className="rounded-xl bg-moss-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-moss-700">Try again</button>}
              </div>
            </div>
          ) : result ? (
            <div className="space-y-3">
              {error && <p role="alert" className="animate-fade-in rounded-xl bg-clay-100 px-4 py-2 text-sm text-clay-700">Latest run failed: {error} Showing the previous result.</p>}
              <ResultsDashboard key={runId} result={result} onError={onError} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
