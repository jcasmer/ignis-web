import type { Http } from '@/api/http';
import type { KnowledgeDocument } from '@/api/tenant';

interface Page<T> {
  items: T[];
  next_cursor?: string;
}

/** A chunk a document was cut into, as the Ignis team inspects it. */
export interface ChunkInfo {
  id: string;
  position: number;
  section: string;
  content: string;
  characters: number;
  /** False when the chunk was indexed for keyword search only. */
  embedded: boolean;
}

/** A passage a test search found, with where each ranking put it (0: that ranking did not find it). */
export interface SearchHit {
  chunk_id: string;
  document_id: string;
  document_title: string;
  section: string;
  content: string;
  score: number;
  /** What the reranker gave the passage (0 does not answer … 3 answers); -1 when it did not grade. */
  grade: number;
  /** Cosine similarity with the question (0 to 1) when found by meaning; 0 otherwise. */
  similarity: number;
  vector_rank: number;
  keyword_rank: number;
  /** False when the passage would be left out for not being similar enough. */
  kept: boolean;
}

export interface SearchResult {
  /** False when only keywords were available. */
  by_meaning: boolean;
  /** True when a model graded the candidates and put them in its order. */
  reranked: boolean;
  /** The similarity below which a passage does not reach the assistant; 0: no cut. */
  min_similarity: number;
  items: SearchHit[];
}

/** A question the base is expected to answer. */
export interface EvalCase {
  id: string;
  question: string;
  /** What the right passage must contain; empty: the base has nothing about it. */
  expect: string;
  /** The customer message before the question, when the question leans on it. */
  context: string;
  created_at: string;
}

export interface EvalResult {
  case: EvalCase;
  /** What was searched: the question, or its rewriting with the earlier message. */
  query: string;
  /** Place (from 1) of the first right passage among those the assistant would get; 0: none. */
  rank: number;
  /** How many passages the assistant would get. */
  found: number;
  top_similarity: number;
  passed: boolean;
}

export interface EvalReport {
  by_meaning: boolean;
  reranked: boolean;
  min_similarity: number;
  limit: number;
  passed: number;
  total: number;
  /** Share of the cases with an expected text that found it. */
  hit_rate: number;
  /** Mean of 1/rank of the first right passage. */
  mrr: number;
  /** Cases that expect nothing, and how many of them found nothing. */
  unanswerable: number;
  silent: number;
  results: EvalResult[];
}

/** A switch the Ignis team sets for a tenant: its own choice, or null to follow the platform. */
export interface KnowledgeFlag {
  own: boolean | null;
  /** What applies without a choice: the platform's value. */
  default: boolean;
  effective: boolean;
  /** False when the platform cannot do it: it asks a model and none is configured. */
  available: boolean;
}

export interface KnowledgeOptions {
  rewrite: KnowledgeFlag;
  rerank: KnowledgeFlag;
  min_similarity: { own: number | null; default: number; effective: number };
}

/** What is sent to choose the options of a tenant; null follows the platform. */
export interface KnowledgeOptionsInput {
  rewrite: boolean | null;
  rerank: boolean | null;
  min_similarity: number | null;
}

/** What a search or an evaluation may try instead of what applies to the tenant. */
export interface TryOptions {
  minSimilarity?: number;
  rerank?: boolean;
  rewrite?: boolean;
}

/** The documents of a knowledge base: the tenant's own, or one an operator manages. */
export interface KnowledgeClient {
  documents(p?: { cursor?: string; limit?: number }): Promise<Page<KnowledgeDocument>>;
  uploadDocument(file: File, title?: string): Promise<KnowledgeDocument>;
  reindexDocument(id: string): Promise<void>;
  reindexAll(): Promise<{ documents: number }>;
  deleteDocument(id: string): Promise<void>;
  /** Only the Ignis team can look inside a base: how documents were cut and how a search ranks. */
  chunks?(id: string): Promise<{ items: ChunkInfo[] }>;
  search?(q: string, limit?: number, o?: TryOptions): Promise<SearchResult>;
  evalCases?(): Promise<{ items: EvalCase[] }>;
  addEvalCase?(question: string, expect: string, context?: string): Promise<EvalCase>;
  deleteEvalCase?(id: string): Promise<void>;
  runEval?(limit?: number, o?: TryOptions): Promise<EvalReport>;
  getOptions?(): Promise<KnowledgeOptions>;
  putOptions?(o: KnowledgeOptionsInput): Promise<KnowledgeOptions>;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function knowledgeClient(
  http: Http,
  base: string,
  opts: { inspect?: boolean } = {},
): KnowledgeClient {
  const one = (id: string) => `${base}/documents/${encodeURIComponent(id)}`;
  return {
    documents: (p = {}) => http.get(`${base}/documents${query(p)}`),
    uploadDocument: (file, title) => {
      const form = new FormData();
      form.set('file', file);
      if (title) form.set('title', title);
      return http.post(`${base}/documents`, form);
    },
    reindexDocument: (id) => http.post(`${one(id)}/reindex`, {}),
    reindexAll: () => http.post(`${base}/reindex`, {}),
    deleteDocument: (id) => http.del(one(id)),
    ...(opts.inspect && {
      chunks: (id: string) => http.get(`${one(id)}/chunks`),
      search: (q: string, limit = 5, o: TryOptions = {}) =>
        http.get(
          `${base}/search${query({ q, limit, min_similarity: o.minSimilarity, rerank: o.rerank })}`,
        ),
      evalCases: () => http.get(`${base}/eval/cases`),
      addEvalCase: (question: string, expect: string, context = '') =>
        http.post(`${base}/eval/cases`, { question, expect, context }),
      deleteEvalCase: (id: string) => http.del(`${base}/eval/cases/${encodeURIComponent(id)}`),
      runEval: (limit = 5, o: TryOptions = {}) =>
        http.post(
          `${base}/eval/run${query({ limit, min_similarity: o.minSimilarity, rerank: o.rerank, rewrite: o.rewrite })}`,
          {},
        ),
      getOptions: () => http.get(`${base}/options`),
      putOptions: (o: KnowledgeOptionsInput) => http.put(`${base}/options`, o),
    }),
  };
}
