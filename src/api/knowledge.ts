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
  vector_rank: number;
  keyword_rank: number;
}

export interface SearchResult {
  /** False when only keywords were available. */
  by_meaning: boolean;
  items: SearchHit[];
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
  search?(q: string, limit?: number): Promise<SearchResult>;
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
      search: (q: string, limit = 5) => http.get(`${base}/search${query({ q, limit })}`),
    }),
  };
}
