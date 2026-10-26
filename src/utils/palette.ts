/**
 * Colours of the charts: the brand teal first, then hues that stay apart from it
 * and from each other. No red, which is kept for errors.
 */
export const chartColors = {
  brand: '#0d8f83',
  sand: '#c9a86a',
  blue: '#4f7fd1',
  plum: '#8a6bbf',
  slate: '#7c8aa5',
  stone: '#9aa8b0',
} as const;

export const reasonColors: Record<string, string> = {
  contact_request: chartColors.brand,
  assistant: chartColors.sand,
  failures: chartColors.blue,
};
