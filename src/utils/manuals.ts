import { Marked } from 'marked';

export type Series = 'equipo' | 'cliente';

export interface Manual {
  series: Series;
  slug: string;
  title: string;
  markdown: string;
}

// The manuals live in the repository as Markdown, next to their screenshots;
// the build bundles them so the console shows exactly what was reviewed.
const sources = import.meta.glob<string>('../../docs/manuales/{equipo,cliente}/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const images = import.meta.glob<string>('../../docs/manuales/imagenes/*', {
  query: '?url',
  import: 'default',
  eager: true,
});

function titleOf(markdown: string, fallback: string): string {
  const line = markdown.split('\n').find((l) => l.startsWith('# '));
  // "# 10. Pestaña Automatizaciones" shows without its number.
  return line
    ? line
        .slice(2)
        .replace(/^\d+\.\s*/, '')
        .trim()
    : fallback;
}

const all: Manual[] = Object.entries(sources)
  .map(([path, markdown]) => {
    const [, series, slug] = /\/(equipo|cliente)\/([^/]+)\.md$/.exec(path) ?? [];
    return {
      series: series as Series,
      slug: slug ?? '',
      title: titleOf(markdown, slug ?? ''),
      markdown,
    };
  })
  .filter((m) => m.slug)
  .sort((a, b) => a.slug.localeCompare(b.slug));

export const manualsOf = (series: Series): Manual[] => all.filter((m) => m.series === series);

export const findManual = (series: string, slug: string): Manual | undefined =>
  all.find((m) => m.series === series && m.slug === slug);

/** GitHub-style anchor: lowercase, no punctuation, spaces as hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface RenderContext {
  /** The series of the manual being shown: relative links resolve inside it. */
  series: Series;
  /** The series this person may open. */
  allowed: Series[];
  /** Where the manuals live in the router, such as /app/help. */
  base: string;
  /** Maps a screenshot name to its built URL. */
  image?: (name: string) => string | undefined;
}

const parser = new Marked({
  gfm: true,
  walkTokens(token) {
    // The manuals are plain Markdown: raw HTML is shown as text, never run.
    if (token.type === 'html') token.text = escapeHtml(token.text);
  },
});

const MANUAL_LINK = /^(?:\.\.?\/)?(?:(equipo|cliente)\/)?(\d\d-[a-z0-9-]+)\.md(#.*)?$/;

export function renderMarkdown(markdown: string, ctx: RenderContext): string {
  const html = parser.parse(markdown, { async: false });

  return html
    .replace(/<h([1-4])>([\s\S]*?)<\/h\1>/g, (_, level: string, inner: string) => {
      // "## Precios de IA {#precios-de-ia}" names its own anchor.
      const named = /\s*\{#([\w-]+)\}\s*$/.exec(inner);
      const id = named ? named[1] : slugify(inner);
      const text = named ? inner.slice(0, named.index) : inner;
      return `<h${level} id="${id}">${text}</h${level}>`;
    })
    .replace(
      /<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g,
      (whole, href: string, rest: string, text: string) => {
        const decoded = href.replace(/&amp;/g, '&');
        if (/^https?:\/\//.test(decoded)) {
          return `<a href="${href}"${rest} target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        if (decoded.startsWith('#'))
          return `<a href="${href}"${rest} data-anchor="${href.slice(1)}">${text}</a>`;
        const m = MANUAL_LINK.exec(decoded);
        if (!m) return text;
        const series = (m[1] as Series | undefined) ?? ctx.series;
        // A link to a manual this person cannot open reads as plain text.
        if (!ctx.allowed.includes(series)) return text;
        const to = `${ctx.base}/${series}/${m[2]}${m[3] ?? ''}`;
        return `<a href="${to}"${rest} data-route="${to}">${text}</a>`;
      },
    )
    .replace(/<img src="([^"]*)"/g, (whole, src: string) => {
      const name = src.split('/').pop() ?? '';
      const url = ctx.image?.(name) ?? images[`../../docs/manuales/imagenes/${name}`];
      return url ? `<img loading="lazy" src="${url}"` : whole;
    });
}
