/**
 * Colours of the charts: amber first, then hues that stay apart from it and from
 * each other. No red, which is kept for errors.
 */
export const chartColors = {
  amber: '#f2a900',
  umber: '#8a5d00',
  teal: '#2f8f83',
  blue: '#3b6fb6',
  sand: '#d9c9a3',
  stone: '#a39270',
  plum: '#7b5ea7',
} as const;

export const reasonColors: Record<string, string> = {
  contact_request: chartColors.amber,
  assistant: chartColors.teal,
  failures: chartColors.umber,
};
