import { describe, expect, it } from 'vitest';

import { toConnectorInput, emptyConnector } from '@/utils/connectors';
import { isUntouched, operationName, parseOpenApi, sanitizeSchema } from '@/utils/openapi';

const SPEC = `
openapi: 3.0.3
info: {title: Agenda de reservas, version: "1"}
servers:
  - url: /relative
  - url: https://api.agenda.co/v1/
paths:
  /bookings/{id}:
    parameters:
      - {name: id, in: path, required: true, schema: {type: string}}
    get:
      operationId: getBooking
      summary: Busca una reserva
      parameters:
        - {name: expand, in: query, schema: {type: boolean}, description: Incluye al cliente}
  /bookings:
    post:
      operationId: createBooking
      summary: Crea una reserva
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewBooking'
components:
  schemas:
    NewBooking:
      type: object
      required: [name, guests]
      properties:
        name: {type: string, example: Ana}
        guests: {type: integer, minimum: 1}
        customer: {$ref: '#/components/schemas/Customer'}
    Customer:
      type: object
      properties:
        email: {type: string, nullable: true}
        friend: {$ref: '#/components/schemas/Customer'}
`;

function ok(text: string) {
  const r = parseOpenApi(text);
  if (!r.ok) throw new Error(`expected a result, got ${r.error}`);
  return r;
}

describe('parseOpenApi', () => {
  it('turns a YAML file into operations the editor accepts', () => {
    const r = ok(SPEC);
    expect(r.title).toBe('Agenda de reservas');
    expect(r.baseUrl).toBe('https://api.agenda.co/v1');
    expect(r.skipped).toEqual([]);
    expect(r.operations.map((o) => [o.source, o.draft.name, o.draft.method])).toEqual([
      ['GET /bookings/{id}', 'get_booking', 'GET'],
      ['POST /bookings', 'create_booking', 'POST'],
    ]);

    // What was imported is valid for the same checks the form does before saving.
    const draft = {
      ...emptyConnector(),
      name: 'agenda',
      baseUrl: r.baseUrl ?? '',
      secret: 'x',
      operations: r.operations.map((o) => o.draft),
    };
    expect(toConnectorInput(draft).ok).toBe(true);
  });

  it('puts path, query and body arguments together and requires the right ones', () => {
    const [get, post] = ok(SPEC).operations.map((o) => JSON.parse(o.draft.params));
    expect(Object.keys(get.properties)).toEqual(['id', 'expand']);
    expect(get.required).toEqual(['id']);
    expect(get.properties.expand.description).toBe('Incluye al cliente');
    expect(post.required).toEqual(['name', 'guests']);
    expect(post.properties.guests).toEqual({ type: 'integer', minimum: 1 });
  });

  it('inlines references, drops examples and OpenAPI-only keywords, and survives a loop', () => {
    const post = JSON.parse(ok(SPEC).operations[1]!.draft.params);
    expect(post.properties.name).toEqual({ type: 'string' });
    const customer = post.properties.customer;
    expect(customer.properties.email).toEqual({ type: 'string' });
    // `friend` points back at Customer: the loop is cut there, not followed forever.
    expect(customer.properties.friend).toEqual({});
    expect(JSON.stringify(post).length).toBeLessThan(2000);
  });

  it('reads JSON as well', () => {
    const r = ok(
      JSON.stringify({
        openapi: '3.1.0',
        paths: { '/ping': { get: { summary: 'Ping' } } },
      }),
    );
    expect(r.operations[0]?.draft).toMatchObject({
      name: 'get_ping',
      path: '/ping',
      method: 'GET',
    });
    expect(r.baseUrl).toBeNull();
  });

  it('skips what cannot become a tool, and says why', () => {
    const r = ok(`
openapi: 3.0.0
paths:
  /a:
    get:
      parameters: [{name: X-Key, in: header, schema: {type: string}}]
  /b:
    post:
      requestBody: {content: {application/json: {schema: {type: array, items: {type: string}}}}}
  /c/{item-id}:
    get: {}
  /d:
    get:
      parameters: [{name: q, in: query, schema: {type: string}}]
    post:
      parameters: [{name: q, in: query, schema: {type: string}}]
      requestBody: {content: {application/json: {schema: {type: object, properties: {q: {type: string}}}}}}
`);
    expect(r.operations.map((o) => o.source)).toEqual(['GET /d']);
    expect(r.skipped).toEqual([
      { source: 'GET /a', reason: 'headerParam' },
      { source: 'POST /b', reason: 'body' },
      { source: 'GET /c/{item-id}', reason: 'segment' },
      { source: 'POST /d', reason: 'collision' },
    ]);
  });

  it('keeps names unique and stops at the 50 operations an API accepts', () => {
    const paths: Record<string, unknown> = {};
    for (let i = 0; i < 55; i++) paths[`/r${i}`] = { get: { operationId: 'same' } };
    const r = ok(JSON.stringify({ openapi: '3.0.0', paths }));
    expect(r.operations).toHaveLength(50);
    expect(new Set(r.operations.map((o) => o.draft.name)).size).toBe(50);
    expect(r.skipped).toHaveLength(5);
    expect(r.skipped.every((s) => s.reason === 'limit')).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['{oops', 'syntax'],
    ['key: [unclosed', 'syntax'],
    ['swagger: "2.0"\npaths: {}', 'version'],
    ['just text', 'version'],
    ['openapi: 3.0.0\npaths: {}', 'noPaths'],
    ['x'.repeat((2 << 20) + 1), 'tooBig'],
  ])('rejects %j as %s', (text, error) => {
    expect(parseOpenApi(text)).toEqual({ ok: false, error });
  });

  it('refuses an alias bomb', () => {
    const lines = ['a: &a [x,x,x,x,x,x,x,x,x]'];
    let prev = 'a';
    for (let i = 0; i < 60; i++) {
      lines.push(`b${i}: &b${i} [*${prev},*${prev}]`);
      prev = `b${i}`;
    }
    expect(parseOpenApi(`openapi: 3.0.0\n${lines.join('\n')}`)).toEqual({
      ok: false,
      error: 'syntax',
    });
  });
});

describe('sanitizeSchema', () => {
  const clean = (schema: unknown) => {
    const dropped = new Set<string>();
    return { out: sanitizeSchema(schema, dropped), dropped: [...dropped].sort() };
  };

  it('keeps what the API understands and reports what it leaves out', () => {
    const { out, dropped } = clean({
      type: 'object',
      required: ['a', 'ghost'],
      additionalProperties: { type: 'string' },
      properties: {
        a: { type: 'integer', minimum: 1, exclusiveMinimum: true, multipleOf: 2, readOnly: true },
        b: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
        c: {
          type: 'array',
          items: { type: 'string', enum: ['x', 'y'], format: 'date' },
          uniqueItems: true,
        },
      },
    });
    expect(out).toEqual({
      type: 'object',
      // `ghost` is not a property: the API would refuse the schema.
      required: ['a'],
      properties: {
        a: { type: 'integer', minimum: 1 },
        b: {},
        c: { type: 'array', items: { type: 'string', enum: ['x', 'y'], format: 'date' } },
      },
    });
    expect(dropped).toEqual([
      'additionalProperties',
      'exclusiveMinimum',
      'multipleOf',
      'oneOf',
      'uniqueItems',
    ]);
  });

  it('merges allOf into one object', () => {
    const { out } = clean({
      allOf: [
        { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        { properties: { name: { type: 'string' } }, required: ['name'] },
      ],
    });
    expect(out).toEqual({
      type: 'object',
      required: ['id', 'name'],
      properties: { id: { type: 'string' }, name: { type: 'string' } },
    });
  });

  it('leaves open what is too deep, and what is not a schema', () => {
    let deep: Record<string, unknown> = { type: 'string' };
    for (let i = 0; i < 15; i++) deep = { type: 'object', properties: { x: deep } };
    expect(JSON.stringify(clean(deep).out)).not.toContain('"string"');
    expect(clean('text').out).toEqual({});
    expect(clean({ type: 'file' }).dropped).toEqual(['type']);
  });

  it('only allows a boolean additionalProperties', () => {
    expect(clean({ type: 'object', additionalProperties: false }).out).toEqual({
      type: 'object',
      additionalProperties: false,
    });
  });
});

describe('small helpers', () => {
  it('derives a valid tool name', () => {
    expect(operationName('getBookingById', 'GET', '/x')).toBe('get_booking_by_id');
    expect(operationName(undefined, 'POST', '/bookings/{id}/cancel')).toBe(
      'post_bookings_id_cancel',
    );
    expect(operationName('1st-op', 'GET', '/x')).toBe('op_1st_op');
    expect(operationName('a'.repeat(60), 'GET', '/x')).toHaveLength(40);
  });

  it('recognises the operation the editor starts with', () => {
    const draft = emptyConnector().operations[0]!;
    expect(isUntouched(draft)).toBe(true);
    expect(isUntouched({ ...draft, name: 'x' })).toBe(false);
  });
});
