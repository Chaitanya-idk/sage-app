import type {
  ChatMessage, CropListResponse, DiagnoseParams, DiagnoseResponse, HealthResponse,
  ModelStatusResponse, RetrievedChunk,
} from '../types/sage';

const BASE = (import.meta.env.VITE_MIDDLEWARE_URL ?? 'http://localhost:8001').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

function friendly(status: number, detail?: string): string {
  switch (status) {
    case 400: return `Invalid request${detail ? `: ${detail}` : '.'}`;
    case 413: return detail ?? 'The image is too large — the limit is 10 MB.';
    case 415: return 'Unsupported image format. Please upload a JPEG, PNG or WebP image.';
    case 422: return `The image or form could not be processed${detail ? `: ${detail}` : '.'}`;
    case 500: return `Server error${detail ? `: ${detail}` : ' — please try again.'}`;
    case 502: return detail ?? 'Backend offline — restart the Kaggle notebook and update BACKEND_URL.';
    case 504: return detail ?? 'The diagnosis timed out. The GPU may be loading a new crop adapter — please retry.';
    default: return detail ?? `Unexpected error (HTTP ${status}).`;
  }
}

const networkError = () =>
  new ApiError(0, `Cannot reach the SAGE middleware at ${BASE}. Is it running on port 8001?`, 'network');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw networkError();
  }
  if (!res.ok) {
    let body: { detail?: string; error?: string } = {};
    try { body = await res.json(); } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, friendly(res.status, body.detail), body.error);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  crops: () => request<CropListResponse>('/api/crops'),
  modelStatus: () => request<ModelStatusResponse>('/api/model/status'),

  diagnose(p: DiagnoseParams) {
    const fd = new FormData();
    fd.append('crop', p.crop);
    fd.append('image', p.image);
    if (p.prompt?.trim()) fd.append('prompt', p.prompt.trim());
    if (p.max_new_tokens != null) fd.append('max_new_tokens', String(p.max_new_tokens));
    if (p.temperature != null) fd.append('temperature', String(p.temperature));
    Object.entries(p.farm).forEach(([k, v]) => v && fd.append(k, v));
    return request<DiagnoseResponse>('/api/diagnose', { method: 'POST', body: fd });
  },

  /** Streams /api/chat (Server-Sent Events). Resolves when the stream finishes. */
  async chat(
    body: { diagnosis_context: object; messages: ChatMessage[] },
    on: { chunks?: (c: RetrievedChunk[]) => void; delta: (t: string) => void },
    signal?: AbortSignal,
  ) {
    let res: Response;
    try {
      res = await fetch(BASE + '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw networkError();
    }
    if (!res.ok || !res.body) {
      let detail: string | undefined;
      try { detail = (await res.json()).detail; } catch { /* ignore */ }
      throw new ApiError(res.status, friendly(res.status, detail));
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value.replace(/\r\n/g, '\n');
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const event = /^event: (.*)$/m.exec(raw)?.[1];
        const data = /^data: (.*)$/m.exec(raw)?.[1];
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === 'chunks') on.chunks?.(parsed);
        else if (event === 'delta') on.delta(parsed.text);
        else if (event === 'error') throw new ApiError(500, parsed.detail);
      }
    }
  },
};
