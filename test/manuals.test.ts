import { describe, expect, it } from 'vitest';

import { findManual, manualsOf, renderMarkdown, slugify } from '@/utils/manuals';

const ctx = { series: 'cliente' as const, allowed: ['cliente' as const], base: '/app/help' };

describe('manuals', () => {
  it('bundles both series in order, titled without their number', () => {
    const team = manualsOf('equipo');
    const client = manualsOf('cliente');
    expect(team.length).toBe(15);
    expect(client.length).toBe(15);
    expect(team[0]?.slug.startsWith('00-')).toBe(true);
    expect(findManual('equipo', '10-pestana-automatizaciones')?.title).toBe(
      'Pestaña Automatizaciones',
    );
    expect(findManual('cliente', 'nope')).toBeUndefined();
  });

  it('slugifies like GitHub, keeping accents', () => {
    expect(slugify('Tutorial E: seguimiento 24 horas después')).toBe(
      'tutorial-e-seguimiento-24-horas-después',
    );
  });

  it('names an anchor from {#id} and drops the marker', () => {
    const html = renderMarkdown('## Precios de IA {#precios-de-ia}', ctx);
    expect(html).toContain('<h2 id="precios-de-ia">Precios de IA</h2>');
  });

  it('routes links inside the console and flattens the ones that are not allowed', () => {
    const own = renderMarkdown('[Canales](09-canales.md#x)', ctx);
    expect(own).toContain('data-route="/app/help/cliente/09-canales#x"');
    const other = renderMarkdown('[guía](../equipo/10-pestana-automatizaciones.md)', ctx);
    expect(other).not.toContain('<a');
    expect(other).toContain('guía');
    const ops = renderMarkdown('[guía](../equipo/10-pestana-automatizaciones.md)', {
      ...ctx,
      allowed: ['equipo', 'cliente'],
    });
    expect(ops).toContain('data-route="/app/help/equipo/10-pestana-automatizaciones"');
  });

  it('never runs raw HTML', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\nhola <b onclick="x()">a</b>', ctx);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b ');
  });

  it('opens external links in a new tab safely', () => {
    expect(renderMarkdown('[m](https://example.com)', ctx)).toContain('rel="noopener noreferrer"');
  });
});
