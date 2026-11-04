// ---- Backend (proxied unchanged by the middleware) ----
export interface CropDetail {
  crop_id: string;
  display_name: string;
  hf_repo: string;
  checkpoint_subpath: string;
  model_type: string;
  adapter_name: string;
  default_prompt: string;
  loading_status: string;
  classes_count: number;
  known_classes: string[];
}

export interface CropListResponse {
  total_crops: number;
  available_crops: string[];
  crop_details: CropDetail[];
}

export interface GPUStatus {
  available: boolean;
  device_name: string | null;
  total_memory_gb: number | null;
  allocated_memory_gb: number | null;
  reserved_memory_gb: number | null;
}

export interface ModelStatusResponse {
  base_model: string;
  active_crop: string | null;
  active_adapter: string | null;
  adapter_mode: string;
  base_model_loaded: boolean;
  loaded_adapters: string[];
  gpu_status: GPUStatus;
  mock_mode: boolean;
}

export interface BackendHealth {
  status: string;
  service: string;
  device: string;
  base_model_loaded: boolean;
  active_crop: string | null;
}

export interface PredictionOutput {
  response: string;
  class_name: string | null;
  crop: string | null;
  disease_type: string | null;
  plant_organ: string | null;
  visual_symptoms: string | null;
  pathogen: string | null;
  matched_taxonomy_class: string | null;
  is_canonical_match: boolean | null;
  attributes: Record<string, unknown>;
}

export interface PredictionResponse {
  success: boolean;
  crop: string;
  base_model: string;
  active_adapter: string;
  checkpoint: string;
  input: { prompt: string };
  prediction: PredictionOutput;
  raw_output: string;
  inference_time_seconds: number;
  image_metadata: { width?: number; height?: number; format?: string } | null;
}

// ---- Middleware ----
export interface RetrievedChunk {
  id: string;
  text: string;
  source: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface Retrieval {
  query: string;
  chunks: RetrievedChunk[];
  skipped_reason?: string | null;
}

export type Severity = 'low' | 'medium' | 'high' | 'unknown';
export type Confidence = 'low' | 'medium' | 'high';

export interface Advisory {
  summary: string;
  severity: Severity;
  treatments: { chemical: string[]; organic: string[]; cultural: string[] };
  prevention: string[];
  optimal_conditions: string;
  citations: { chunk_id: string; source: string }[];
  confidence: Confidence;
  needs_expert: boolean;
  expert_reason: string;
}

export interface Timings {
  inference_s: number;
  retrieval_s: number;
  llm_s: number;
  total_s: number;
}

export interface PartialFailure {
  retrieval?: string | null;
  llm?: string | null;
}

export interface FarmContext {
  growth_stage?: string;
  soil_hydration?: string;
  recent_weather?: string;
  past_treatments?: string;
  notes?: string;
}

export interface DiagnoseResponse {
  prediction: PredictionResponse;
  retrieval: Retrieval;
  advisory: Advisory | null;
  farm_context: Record<string, string>;
  timings: Timings;
  partial_failure: PartialFailure | null;
}

export interface DiagnoseParams {
  crop: string;
  image: File;
  prompt?: string;
  max_new_tokens?: number;
  temperature?: number;
  farm: FarmContext;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface HealthResponse {
  middleware: { status: 'ok' };
  backend: {
    status: 'ok' | 'down';
    url: string;
    health: BackendHealth | null;
    model_status: ModelStatusResponse | null;
    error?: string | null;
  };
  chromadb: { status: 'ok' | 'error'; collection?: string; doc_count?: number; embedding_model?: string; error?: string };
  llm: { status: 'ok' | 'not_configured'; provider: string; model: string; configured: boolean };
}
