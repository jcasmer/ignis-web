import { parse } from 'yaml';

import type { OperationMethod } from '@/api/tenant';

import { EMPTY_SCHEMA, type OperationDraft } from './connectors';

/** An OpenAPI file is text from outside: it is read here, never run and never fetched. */
export const MAX_SPEC_BYTES = 2 << 20;
const MAX_OPERATIONS = 50;
const MAX_PARAMS_BYTES = 16 << 10;
const MAX_REF_DEPTH = 8;
const METHODS: OperationMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const SEGMENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export interface ImportedOperation {
  /** Where it came from, as the file names it: `GET /bookings/{id}`. */
  source: string;
  draft: OperationDraft;
}

export interface SkippedOperation {
  source: string;
  reason: SkipReason;
}

export type SkipReason =
  'segment' | 'headerParam' | 'body' | 'collision' | 'tooBig' | 'path' | 'limit';

export type OpenApiError = 'empty' | 'tooBig' | 'syntax' | 'version' | 'noPaths';

export type OpenApiResult =
  | {
      ok: true;
      title: string;
      /** The first absolute https server, without a trailing slash. */
      baseUrl: string | null;
      operations: ImportedOperation[];
      skipped: SkippedOperation[];
      /** Keywords of the file the API does not understand, left out of the arguments. */
      simplified: string[];
    }
  | { ok: false; error: OpenApiError };

// --- $ref ---------------------------------------------------------------------------

/** Follows `#/a/b` inside the same file; anything else is not followed. */
function lookup(root: Json, ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined;
  let node: unknown = root;
  for (const raw of ref.slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObject(node) && !Array.isArray(node)) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** The node with its local `$ref`s replaced by what they point to, so it stands alone. */
function inline(node: unknown, root: Json, depth = 0, chain: string[] = []): unknown {
  if (Array.isArray(node)) return node.map((n) => inline(n, root, depth, chain));
  if (!isObject(node)) return node;
  if (typeof node.$ref === 'string') {
    // A loop or something too deep is left open: the arguments accept anything there.
    if (depth >= MAX_REF_DEPTH || chain.includes(node.$ref)) return {};
    return inline(lookup(root, node.$ref) ?? {}, root, depth + 1, [...chain, node.$ref]);
  }
  const out: Json = {};
  for (const [k, v] of Object.entries(node)) out[k] = inline(v, root, depth, chain);
  return out;
}

// --- the schema the API accepts ------------------------------------------------------

// The API checks the arguments of a tool against a subset of JSON Schema and refuses a
// schema that uses anything else when it is saved. What a file uses outside it is left
// out here, and the keywords that were left out are reported.
const TYPES = ['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'];
const MAX_SCHEMA_DEPTH = 10;
const NUMBERS = ['minimum', 'maximum'];
const COUNTS = ['minLength', 'maxLength', 'minItems', 'maxItems'];
const KEEP = ['title', 'description', 'default', 'format'];

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Brings the properties and required fields of every allOf part into one schema. */
function mergeAllOf(node: Json, dropped: Set<string>): Json {
  if (!Array.isArray(node.allOf)) return node;
  const merged: Json = { ...node };
  delete merged.allOf;
  const properties: Json = isObject(merged.properties) ? { ...merged.properties } : {};
  const required = new Set<unknown>(Array.isArray(merged.required) ? merged.required : []);
  for (const part of node.allOf) {
    if (!isObject(part)) continue;
    const p = mergeAllOf(part, dropped);
    if (isObject(p.properties)) Object.assign(properties, p.properties);
    if (Array.isArray(p.required)) for (const r of p.required) required.add(r);
    if (merged.type === undefined && p.type !== undefined) merged.type = p.type;
  }
  if (Object.keys(properties).length) merged.properties = properties;
  if (required.size) merged.required = [...required];
  return merged;
}

/** A schema with only what the API understands; `dropped` collects what was left out. */
export function sanitizeSchema(input: unknown, dropped: Set<string>, depth = 0): Json {
  if (!isObject(input) || depth > MAX_SCHEMA_DEPTH) return {};
  const node = mergeAllOf(input, dropped);
  const out: Json = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'type') {
      const list = Array.isArray(value) ? value : [value];
      if (list.length && list.every((t) => typeof t === 'string' && TYPES.includes(t)))
        out.type = value;
      else dropped.add(key);
    } else if (key === 'properties' && isObject(value)) {
      const props: Json = {};
      for (const [name, child] of Object.entries(value)) {
        props[name] = sanitizeSchema(child, dropped, depth + 1);
      }
      out.properties = props;
    } else if (key === 'items' && isObject(value)) {
      out.items = sanitizeSchema(value, dropped, depth + 1);
    } else if (key === 'additionalProperties' && typeof value === 'boolean') {
      out.additionalProperties = value;
    } else if (key === 'enum' && Array.isArray(value) && value.length <= 256) {
      out.enum = value;
    } else if (key === 'pattern' && typeof value === 'string' && value.length <= 256) {
      out.pattern = value;
    } else if (NUMBERS.includes(key) && typeof value === 'number') {
      out[key] = value;
    } else if (COUNTS.includes(key) && isCount(value)) {
      out[key] = value;
    } else if (KEEP.includes(key)) {
      out[key] = value;
    } else if (
      key !== 'required' &&
      ![
        'example',
        'examples',
        'xml',
        'externalDocs',
        'nullable',
        'deprecated',
        'discriminator',
        'readOnly',
        'writeOnly',
      ].includes(key)
    ) {
      dropped.add(key);
    }
  }
  // A required field must be one of the declared properties, or the API refuses the schema.
  if (Array.isArray(node.required) && isObject(out.properties)) {
    const props = out.properties;
    const required = node.required.filter((r): r is string => typeof r === 'string' && r in props);
    if (required.length) out.required = required;
  }
  return out;
}

// --- names ----------------------------------------------------------------------------

function snake(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** A tool name the API accepts: lowercase, starts with a letter, up to 40 characters. */
export function operationName(operationId: unknown, method: string, path: string): string {
  const fromId = typeof operationId === 'string' ? snake(operationId) : '';
  let name = fromId || snake(`${method} ${path.replace(/[{}]/g, '')}`);
  if (!/^[a-z]/.test(name)) name = `op_${name}`;
  return name.slice(0, 40).replace(/_+$/, '') || 'operation';
}

function unique(name: string, taken: Set<string>): string {
  let candidate = name;
  for (let i = 2; taken.has(candidate); i++) {
    const suffix = `_${i}`;
    candidate = name.slice(0, 40 - suffix.length) + suffix;
  }
  taken.add(candidate);
  return candidate;
}

// --- one operation --------------------------------------------------------------------

function bodySchema(op: Json, root: Json): Json | null | undefined {
  const body = inline(op.requestBody, root);
  if (!isObject(body)) return undefined;
  const content = isObject(body.content) ? body.content : {};
  const json = Object.entries(content).find(([type]) => type.toLowerCase().includes('json'))?.[1];
  const schema = isObject(json) ? json.schema : undefined;
  // `null`: there is a body, but it is not an object that can be spread into arguments.
  if (!isObject(schema) || (schema.type !== undefined && schema.type !== 'object')) return null;
  return schema;
}

function describe(op: Json, fallback: string): string {
  const text = [op.summary, op.description].find((t) => typeof t === 'string' && t.trim());
  return (typeof text === 'string' ? text.trim() : fallback).slice(0, 1000);
}

function buildOperation(
  method: OperationMethod,
  path: string,
  op: Json,
  shared: unknown[],
  root: Json,
  name: string,
  dropped: Set<string>,
): { draft: OperationDraft } | { reason: SkipReason } {
  if (!path.startsWith('/') || /[?#\\]/.test(path) || path.includes('..') || path.includes('//')) {
    return { reason: 'path' };
  }
  for (const m of path.matchAll(/\{([^}]*)\}/g)) {
    if (!SEGMENT.test(m[1] ?? '')) return { reason: 'segment' };
  }

  const properties: Json = {};
  const required = new Set<string>();
  const parameters = [...shared, ...(Array.isArray(op.parameters) ? op.parameters : [])];
  for (const raw of parameters) {
    const p = inline(raw, root);
    if (!isObject(p) || typeof p.name !== 'string') continue;
    if (p.in === 'header' || p.in === 'cookie') return { reason: 'headerParam' };
    if (!SEGMENT.test(p.name)) return { reason: 'segment' };
    const schema = sanitizeSchema(p.schema, dropped);
    if (typeof p.description === 'string' && !('description' in schema)) {
      schema.description = p.description.trim().slice(0, 300);
    }
    properties[p.name] = schema;
    if (p.in === 'path' || p.required === true) required.add(p.name);
  }

  const body = bodySchema(op, root);
  const bodyClean = body ? sanitizeSchema(body, dropped) : body;
  if (body === null) return { reason: 'body' };
  if (bodyClean) {
    const bodyProps = isObject(bodyClean.properties) ? bodyClean.properties : {};
    for (const key of Object.keys(bodyProps)) if (key in properties) return { reason: 'collision' };
    Object.assign(properties, bodyProps);
    if (Array.isArray(bodyClean.required)) {
      for (const r of bodyClean.required) if (typeof r === 'string') required.add(r);
    }
  }
  // Every {segment} of the path must be a required argument.
  for (const m of path.matchAll(/\{([^}]*)\}/g)) {
    const key = m[1] ?? '';
    if (!(key in properties)) properties[key] = { type: 'string' };
    required.add(key);
  }

  const params = JSON.stringify({ type: 'object', properties, required: [...required] }, null, 2);
  if (new TextEncoder().encode(params).length > MAX_PARAMS_BYTES) return { reason: 'tooBig' };

  return {
    draft: {
      name,
      description: describe(op, `${method} ${path}`),
      method,
      path,
      risk: '',
      params,
      fields: '',
    },
  };
}

// --- the file -------------------------------------------------------------------------

function parseText(text: string): unknown {
  const t = text.trim();
  // YAML is a superset of JSON, but a plain JSON.parse gives clearer limits and is faster.
  if (t.startsWith('{')) return JSON.parse(t);
  return parse(t, { maxAliasCount: 50, uniqueKeys: false });
}

function firstServer(spec: Json): string | null {
  const servers = Array.isArray(spec.servers) ? spec.servers : [];
  for (const s of servers) {
    const url = isObject(s) && typeof s.url === 'string' ? s.url.trim() : '';
    if (!url || url.includes('{')) continue;
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash) {
        return url.replace(/\/+$/, '');
      }
    } catch {
      // A relative address (`/v1`) says nothing about where the system is.
    }
  }
  return null;
}

/** Reads an OpenAPI 3 file and proposes the operations it describes. */
export function parseOpenApi(text: string): OpenApiResult {
  if (!text.trim()) return { ok: false, error: 'empty' };
  if (new TextEncoder().encode(text).length > MAX_SPEC_BYTES) return { ok: false, error: 'tooBig' };

  let spec: unknown;
  try {
    spec = parseText(text);
  } catch {
    return { ok: false, error: 'syntax' };
  }
  if (!isObject(spec) || typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.')) {
    return { ok: false, error: 'version' };
  }
  const paths = isObject(spec.paths) ? spec.paths : {};
  if (!Object.keys(paths).length) return { ok: false, error: 'noPaths' };

  const operations: ImportedOperation[] = [];
  const skipped: SkippedOperation[] = [];
  const taken = new Set<string>();
  const dropped = new Set<string>();
  for (const [path, item] of Object.entries(paths)) {
    if (!isObject(item)) continue;
    const shared = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of METHODS) {
      const op = item[method.toLowerCase()];
      if (!isObject(op)) continue;
      const source = `${method} ${path}`;
      if (operations.length >= MAX_OPERATIONS) {
        skipped.push({ source, reason: 'limit' });
        continue;
      }
      const built = buildOperation(
        method,
        path,
        op,
        shared,
        spec,
        unique(operationName(op.operationId, method, path), taken),
        dropped,
      );
      if ('reason' in built) skipped.push({ source, reason: built.reason });
      else operations.push({ source, draft: built.draft });
    }
  }

  const info = isObject(spec.info) ? spec.info : {};
  return {
    ok: true,
    title: typeof info.title === 'string' ? info.title.slice(0, 120) : '',
    baseUrl: firstServer(spec),
    operations,
    skipped,
    simplified: [...dropped].sort(),
  };
}

/** True while the only operation is the untouched one the editor starts with. */
export function isUntouched(op: OperationDraft): boolean {
  return !op.name && !op.description && op.path === '/' && op.params === EMPTY_SCHEMA;
}
