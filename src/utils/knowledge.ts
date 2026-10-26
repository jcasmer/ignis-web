import type { KnowledgeDocument } from '@/api/tenant';

/** How a document was cut: the code decides by the shape of the text, never the person. */
export const strategyKey = (format: KnowledgeDocument['format']): string =>
  ({ plain: 'plain', markdown: 'markdown', table: 'table', paged: 'paged' })[format];

/** The score as people read it: a fused ranking number, not a percentage. */
export const scoreText = (n: number): string => n.toFixed(4);

/** A passage cut short for a list, at a word if it can. */
export function clip(text: string, max = 280): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
