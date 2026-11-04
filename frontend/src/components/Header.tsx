import { Bot, Cpu, Database, Layers, RefreshCw, Server, Sprout, TriangleAlert } from 'lucide-react';
import type { HealthResponse } from '../types/sage';

type Tone = 'ok' | 'bad' | 'warn' | 'idle';

function Badge({ icon: Icon, label, value, tone, title }: {
  icon: typeof Server; label: string; value: string; tone: Tone; title?: string;
}) {
  const dot = { ok: 'bg-moss-500', bad: 'bg-clay-500', warn: 'bg-wheat-500', idle: 'bg-soil-300' }[tone];
  return (
    <div title={title ?? `${label}: ${value}`}
      className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-moss-50 backdrop-blur transition hover:bg-white/15">
      <span className="relative flex size-2">
        {tone === 'ok' && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${dot}`} />}
        <span className={`relative inline-flex size-2 rounded-full ${dot}`} />
      </span>
      <Icon className="size-3.5 opacity-80" />
      <span className="opacity-70">{label}</span>
      <span className="max-w-40 truncate font-medium">{value}</span>
    </div>
  );
}

export default function Header({ health, error, checking, onRefresh }: {
  health: HealthResponse | null; error: string | null; checking: boolean; onRefresh: () => void;
}) {
  const b = health?.backend;
  const ms = b?.model_status;
  const gpu = ms?.gpu_status;
  const up = b?.status === 'ok';
  const gpuValue = gpu?.available
    ? `${gpu.device_name ?? 'GPU'} · ${gpu.allocated_memory_gb?.toFixed(1) ?? '?'}/${gpu.total_memory_gb?.toFixed(0) ?? '?'} GB`
    : ms?.mock_mode ? 'mock mode' : up ? 'CPU' : '—';

  return (
    <header className="sticky top-0 z-40 border-b border-moss-900/40 bg-moss-900/95 text-white shadow-lg backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-moss-400 to-moss-600 shadow-inner ring-1 ring-white/20">
            <Sprout className="size-6" />
          </div>
          <div className="leading-tight">
            <h1 className="font-display text-2xl font-bold tracking-tight">SAGE</h1>
            <p className="text-[11px] text-moss-200">Smart Agricultural Generative Expert</p>
          </div>
          <button onClick={onRefresh} aria-label="Re-check service status"
            className="ml-auto rounded-lg p-2 text-moss-200 transition hover:bg-white/10 hover:text-white lg:hidden">
            <RefreshCw className={`size-4 ${checking ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:justify-end lg:overflow-visible lg:px-0 lg:pb-0">
          {error ? (
            <Badge icon={TriangleAlert} label="Middleware" value="unreachable" tone="bad" title={error} />
          ) : (
            <>
              <Badge icon={Server} label="Backend" value={!health ? 'checking…' : up ? 'online' : 'offline'}
                tone={!health ? 'idle' : up ? 'ok' : 'bad'} title={b?.error ?? b?.url} />
              <Badge icon={Layers} label="Adapter" value={ms?.active_adapter ?? ms?.active_crop ?? 'none'}
                tone={ms?.active_adapter ? 'ok' : 'idle'} />
              <Badge icon={Cpu} label="GPU" value={gpuValue} tone={gpu?.available ? 'ok' : up ? 'warn' : 'idle'} />
              <Badge icon={Database} label="Knowledge"
                value={health?.chromadb.status === 'ok' ? `${(health.chromadb.doc_count ?? 0).toLocaleString()} chunks` : health ? 'error' : '…'}
                tone={!health ? 'idle' : health.chromadb.status === 'ok' ? 'ok' : 'bad'} title={health?.chromadb.error} />
              <Badge icon={Bot} label="LLM" value={health ? `${health.llm.provider} · ${health.llm.model}` : '…'}
                tone={!health ? 'idle' : health.llm.configured ? 'ok' : 'warn'} />
            </>
          )}
          <button onClick={onRefresh} aria-label="Re-check service status"
            className="hidden rounded-full p-2 text-moss-200 transition hover:bg-white/10 hover:text-white lg:block">
            <RefreshCw className={`size-4 ${checking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
