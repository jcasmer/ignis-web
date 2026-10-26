import type { Http } from '@/api/http';
import type { KnowledgeDocument } from '@/api/tenant';

interface Page<T> {
  items: T[];
  next_cursor?: string;
}

/** The documents of a knowledge base: the tenant's own, or one an operator manages. */
export interface KnowledgeClient {
  documents(p?: { cursor?: string; limit?: number }): Promise<Page<KnowledgeDocument>>;
  uploadDocument(file: File, title?: string): Promise<KnowledgeDocument>;
  reindexDocument(id: string): Promise<void>;
  reindexAll(): Promise<{ documents: number }>;
  deleteDocument(id: string): Promise<void>;
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function knowledgeClient(http: Http, base: string): KnowledgeClient {
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
  };
}
