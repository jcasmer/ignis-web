import type { Http } from '@/api/http';

export type TemplateCategory = 'utility' | 'marketing';

/** Where Meta's review of a template stands. */
export type TemplateStatus = 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';

/** What a person writes to ask Meta for a template. */
export interface WhatsAppTemplateInput {
  /** Lowercase letters, digits and underscores. */
  name: string;
  /** A code of Meta, such as es, es_MX or en_US. */
  language: string;
  category: TemplateCategory;
  /** The text: {{1}}, {{2}}... mark where a value goes when it is sent. */
  body: string;
  /** A value for each variable, which Meta reads to review the template. */
  examples: string[];
  footer: string;
}

export interface WhatsAppTemplate extends WhatsAppTemplateInput {
  id: string;
  status: TemplateStatus;
  /** Why Meta rejected it, when it did. */
  reason: string;
  meta_id: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppClient {
  /** The WhatsApp Business Account id the templates belong to; empty when none was set. */
  settings: () => Promise<{ business_account_id: string }>;
  saveSettings: (businessAccountId: string) => Promise<{ business_account_id: string }>;
  templates: () => Promise<{ items: WhatsAppTemplate[] }>;
  create: (input: WhatsAppTemplateInput) => Promise<WhatsAppTemplate>;
  /** Asks Meta how the review of every template stands. */
  sync: () => Promise<{ updated: number; missing: number }>;
  remove: (id: string) => Promise<void>;
  /** Writes to a number with an approved template; one value per variable. */
  send: (id: string, to: string, params: string[]) => Promise<{ message_id: string }>;
}

/** The templates under `base`: `/whatsapp` for the tenant, `/ops/tenants/{id}/whatsapp` for an operator. */
export function whatsappClient(http: Http, base: string): WhatsAppClient {
  const one = (id: string) => `${base}/templates/${encodeURIComponent(id)}`;
  return {
    settings: () => http.get(`${base}/settings`),
    saveSettings: (id) => http.put(`${base}/settings`, { business_account_id: id }),
    templates: () => http.get(`${base}/templates`),
    create: (input) => http.post(`${base}/templates`, input),
    sync: () => http.post(`${base}/templates/sync`, {}),
    remove: (id) => http.del(one(id)),
    send: (id, to, params) => http.post(`${one(id)}/send`, { to, params }),
  };
}
