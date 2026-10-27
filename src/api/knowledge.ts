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
  created_at: string;
}

export interface EvalResult {
  case: EvalCase;
  /** Place (from 1) of the first right passage among those the assistant would get; 0: none. */
  rank: number;
  /** How many passages the assistant would get. */
  found: number;
  top_similarity: number;
  passed: boolean;
}

export interface EvalReport {
  by_meaning: boolean;
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

/** The documents of a knowledge base: the tenant's own, or one an operator manages. */
export interface KnowledgeClient {
  documents(p?: { cursor?: string; limit?: number }): Promise<Page<KnowledgeDocument>>;
  uploadDocument(file: File, title?: string): Promise<KnowledgeDocument>;
  reindexDocument(id: string): Promise<void>;
  reindexAll(): Promise<{ documents: number }>;
  deleteDocument(id: string): Promise<void>;
  /** Only the Ignis team can look inside a base: how documents were cut and how a search ranks. */
  chunks?(id: string): Promise<{ items: ChunkInfo[] }>;
  search?(q: string, limit?: number, minSimilarity?: number): Promise<SearchResult>;
  evalCases?(): Promise<{ items: EvalCase[] }>;
  addEvalCase?(question: string, expect: string): Promise<EvalCase>;
  deleteEvalCase?(id: string): Promise<void>;
  runEval?(limit?: number, minSimilarity?: number): Promise<EvalReport>;
}

function query(params: Record<string, string | number | undefined>): string {
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
      search: (q: string, limit = 5, minSimilarity?: number) =>
        http.get(`${base}/search${query({ q, limit, min_similarity: minSimilarity })}`),
      evalCases: () => http.get(`${base}/eval/cases`),
      addEvalCase: (question: string, expect: string) =>
        http.post(`${base}/eval/cases`, { question, expect }),
      deleteEvalCase: (id: string) => http.del(`${base}/eval/cases/${encodeURIComponent(id)}`),
      runEval: (limit = 5, minSimilarity?: number) =>
        http.post(`${base}/eval/run${query({ limit, min_similarity: minSimilarity })}`, {}),
    }),
  };
}
