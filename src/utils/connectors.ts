import type {
  Connector,
  ConnectorAuthType,
  ConnectorInput,
  ConnectorOperation,
  OperationMethod,
  OperationRisk,
} from '@/api/tenant';

export const METHODS: OperationMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
export const RISKS: OperationRisk[] = ['read', 'write', 'external'];
export const AUTH_TYPES: ConnectorAuthType[] = ['none', 'bearer', 'header', 'basic'];

// The same limits as the API: it decides for real, but the form says what is wrong before sending.
const MAX_OPERATIONS = 50;
const MAX_DESCRIPTION = 1000;
const MAX_PARAMS_BYTES = 16 << 10;
const CONNECTOR_NAME = /^[a-z][a-z0-9]{0,23}$/;
const OPERATION_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const HEADER_NAME = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const FORBIDDEN_HEADERS = [
  'host',
  'content-length',
  'content-type',
  'transfer-encoding',
  'connection',
  'idempotency-key',
  'accept',
];
const PLACEHOLDER = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
const FIELD_PATH = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

/** Without a stated risk a GET only reads and anything else changes something. */
export function effectiveRisk(op: Pick<ConnectorOperation, 'method' | 'risk'>): OperationRisk {
  return op.risk ?? (op.method === 'GET' ? 'read' : 'write');
}

export function toolName(connector: string, operation: string): string {
  return `${connector}_${operation}`;
}

/** The address without its path: what a person recognises the system by. */
export function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

// --- the form -------------------------------------------------------------------

export interface OperationDraft {
  name: string;
  description: string;
  method: OperationMethod;
  path: string;
  /** Empty means the default of the method. */
  risk: '' | OperationRisk;
  /** The JSON Schema as text, so it can be written by hand. */
  params: string;
  /** One dot-separated path per line (or comma). */
  fields: string;
}

export interface ConnectorDraft {
  isNew: boolean;
  name: string;
  description: string;
  baseUrl: string;
  authType: ConnectorAuthType;
  header: string;
  enabled: boolean;
  /** Empty keeps the stored one. */
  secret: string;
  hasSecret: boolean;
  operations: OperationDraft[];
}

export const EMPTY_SCHEMA = '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}';

export function emptyOperation(): OperationDraft {
  return {
    name: '',
    description: '',
    method: 'GET',
    path: '/',
    risk: '',
    params: EMPTY_SCHEMA,
    fields: '',
  };
}

export function emptyConnector(): ConnectorDraft {
  return {
    isNew: true,
    name: '',
    description: '',
    baseUrl: 'https://',
    authType: 'bearer',
    header: '',
    enabled: true,
    secret: '',
    hasSecret: false,
    operations: [emptyOperation()],
  };
}

export function draftFromConnector(c: Connector): ConnectorDraft {
  return {
    isNew: false,
    name: c.name,
    description: c.description ?? '',
    baseUrl: c.base_url,
    authType: c.auth.type,
    header: c.auth.header ?? '',
    enabled: c.enabled ?? true,
    secret: '',
    hasSecret: c.has_secret,
    operations: c.operations.map((o) => ({
      name: o.name,
      description: o.description,
      method: o.method,
      path: o.path,
      risk: o.risk ?? '',
      params: JSON.stringify(o.params, null, 2),
      fields: (o.response_fields ?? []).join('\n'),
    })),
  };
}

export type ConnectorError =
  | 'name'
  | 'description'
  | 'baseUrl'
  | 'header'
  | 'secret'
  | 'operations'
  | 'duplicate'
  | 'opName'
  | 'opDescription'
  | 'opPath'
  | 'opParams'
  | 'opPlaceholder'
  | 'opFields';

export type ConnectorResult =
  | { ok: true; input: ConnectorInput }
  /** `op` is the position (from 0) of the operation at fault, when there is one. */
  | { ok: false; error: ConnectorError; op?: number };

function parseParams(text: string): Record<string, unknown> | null {
  if (!text.trim() || new TextEncoder().encode(text).length > MAX_PARAMS_BYTES) return null;
  try {
    const v: unknown = JSON.parse(text);
    return v !== null && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function splitFields(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

function checkBase(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl.trim());
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash;
  } catch {
    return false;
  }
}

function checkOperation(d: OperationDraft, i: number): ConnectorResult | ConnectorOperation {
  const fail = (error: ConnectorError): ConnectorResult => ({ ok: false, error, op: i });
  if (!OPERATION_NAME.test(d.name)) return fail('opName');
  if (!d.description.trim() || d.description.length > MAX_DESCRIPTION) return fail('opDescription');
  const path = d.path;
  if (!path.startsWith('/') || /[?#\\]/.test(path) || path.includes('..') || path.includes('//')) {
    return fail('opPath');
  }
  const params = parseParams(d.params);
  if (!params || params.type !== 'object') return fail('opParams');
  const properties = (params.properties ?? {}) as Record<string, unknown>;
  const required = Array.isArray(params.required) ? (params.required as unknown[]) : [];
  for (const m of path.matchAll(PLACEHOLDER)) {
    const key = m[1] ?? '';
    if (!(key in properties) || !required.includes(key)) return fail('opPlaceholder');
  }
  const fields = splitFields(d.fields);
  if (fields.some((f) => !FIELD_PATH.test(f))) return fail('opFields');

  return {
    name: d.name,
    description: d.description.trim(),
    method: d.method,
    path,
    params,
    ...(d.risk && { risk: d.risk }),
    ...(fields.length && { response_fields: fields }),
  };
}

/** The form as the API wants it, or the first thing that is wrong with it. */
export function toConnectorInput(d: ConnectorDraft): ConnectorResult {
  if (!CONNECTOR_NAME.test(d.name)) return { ok: false, error: 'name' };
  if (d.description.length > MAX_DESCRIPTION) return { ok: false, error: 'description' };
  if (!checkBase(d.baseUrl)) return { ok: false, error: 'baseUrl' };
  if (
    d.authType === 'header' &&
    (!HEADER_NAME.test(d.header) || FORBIDDEN_HEADERS.includes(d.header.toLowerCase()))
  ) {
    return { ok: false, error: 'header' };
  }
  // Without a credential a new connector with authentication could not sign in anywhere.
  if (d.isNew && d.authType !== 'none' && !d.secret.trim()) return { ok: false, error: 'secret' };
  if (!d.operations.length || d.operations.length > MAX_OPERATIONS) {
    return { ok: false, error: 'operations' };
  }

  const operations: ConnectorOperation[] = [];
  for (const [i, draft] of d.operations.entries()) {
    const r = checkOperation(draft, i);
    if ('ok' in r) return r;
    if (operations.some((o) => o.name === r.name)) return { ok: false, error: 'duplicate', op: i };
    operations.push(r);
  }

  return {
    ok: true,
    input: {
      ...(d.description.trim() && { description: d.description.trim() }),
      base_url: d.baseUrl.trim(),
      auth: { type: d.authType, ...(d.authType === 'header' && { header: d.header }) },
      enabled: d.enabled,
      operations,
      // Only a secret that was typed goes out: leaving it empty keeps the stored one.
      ...(d.authType !== 'none' && d.secret.trim() && { secret: d.secret.trim() }),
    },
  };
}
