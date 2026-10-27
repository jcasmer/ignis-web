import type { Http } from '@/api/http';

export type AssistantTone = 'friendly' | 'formal' | 'enthusiastic' | 'neutral';

/** What a person says about the business. Every field is optional. */
export interface AssistantProfileInput {
  business_name: string;
  about: string;
  /** Empty: no particular tone. */
  tone: AssistantTone | '';
  /** Empty: the assistant answers in the language of the customer. */
  language: string;
  greeting: string;
  always: string[];
  never: string[];
  extra: string;
}

export interface AssistantProfile extends AssistantProfileInput {
  /** The standing instruction the assistant receives, composed from the profile. */
  prompt: string;
  /** True when nothing was said about the business and the platform's instruction applies. */
  is_default: boolean;
  /** The placeholders a free text may use. */
  variables: string[];
  tones: AssistantTone[];
}

export interface AssistantClient {
  get: () => Promise<AssistantProfile>;
  /** Replaces the profile; an empty one takes the assistant back to the platform's instruction. */
  save: (p: AssistantProfileInput) => Promise<AssistantProfile>;
  /** The instruction a profile would give, without saving it. */
  preview: (p: AssistantProfileInput) => Promise<AssistantProfile>;
}

export function assistantClient(http: Http, base: string): AssistantClient {
  return {
    get: () => http.get(`${base}/profile`),
    save: (p) => http.put(`${base}/profile`, p),
    preview: (p) => http.post(`${base}/profile/preview`, p),
  };
}
