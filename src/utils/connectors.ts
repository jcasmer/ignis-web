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

/** The address the form starts with: nothing was typed yet, so an imported one may take its place. */
export function isDefaultBase(baseUrl: string): boolean {
  return baseUrl.trim() === 'https://' || baseUrl.trim() === '';
}

/** A starting value for an argument of the given schema, so the test is one edit away. */
function sample(schema: unknown): unknown {
  const s =
    schema !== null && typeof schema === 'object' ? (schema as Record<string, unknown>) : {};
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
  if (type === 'integer' || type === 'number') return typeof s.minimum === 'number' ? s.minimum : 0;
  if (type === 'boolean') return false;
  if (type === 'array') return [];
  if (type === 'object') return {};
  if (s.format === 'date') return new Date().toISOString().slice(0, 10);
  return '';
}

/** The arguments of an operation as JSON text with its required fields to fill in. */
export function argumentsTemplate(params: Record<string, unknown>): string {
  const properties =
    params.properties !== null && typeof params.properties === 'object'
      ? (params.properties as Record<string, unknown>)
      : {};
  const required = Array.isArray(params.required) ? params.required : [];
  const args: Record<string, unknown> = {};
  for (const name of required) {
    if (typeof name === 'string') args[name] = sample(properties[name]);
  }
  return JSON.stringify(args, null, 2);
}

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

/**
 * The reason a test failed, in Spanish when it is one of the fixed messages of the API.
 * What the client's own system said (the detail after a status) is shown as it came.
 */
export function failureText(message: string): string {
  const m = message.trim();
  if (/could not be reached/i.test(m)) {
    return 'No se pudo conectar con el sistema. Revisa la dirección y que esté disponible desde internet.';
  }
  if (/refused the credentials/i.test(m)) return 'El sistema rechazó la credencial del conector.';
  if (/no credentials configured/i.test(m)) return 'El conector no tiene una credencial guardada.';
  if (/redirected the call/i.test(m))
    return 'El sistema redirigió la llamada, y eso no está permitido.';
  if (/too large/i.test(m))
    return 'La respuesta del sistema es demasiado grande: pide menos datos.';
  const later = /^the system answered (\d{3}); try again later/i.exec(m);
  if (later) return `El sistema respondió ${later[1]}. Inténtalo más tarde.`;
  const detail = /^the system answered (\d{3}): ([\s\S]*)$/i.exec(m);
  if (detail) return `El sistema respondió ${detail[1]}: ${detail[2]}`;
  return m;
}
