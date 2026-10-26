import type { Metric } from '@/utils/stats';

/**
 * How colour is used in the charts. Three rules:
 *
 * 1. A metric has ONE colour, everywhere: its KPI card, its line, its bars and
 *    its row in the reports. People learn "violet is conversations" once.
 * 2. Brand teal is the colour of the main activity (messages received, and the
 *    total of messages), not a default for everything.
 * 3. A comparison draws the metric in its colour and the previous period in a
 *    neutral stone, dashed: the eye goes to what is current.
 *
 * Hues are spread around the wheel so they stay apart, and none of them is red:
 * red means error in this product. Orange is "pay attention".
 */
export const chartColors = {
  brand: '#0d8f83',
  blue: '#4f7fd1',
  violet: '#8a6bbf',
  green: '#5aa469',
  gold: '#c9a227',
  orange: '#e0791e',
  slate: '#7c8aa5',
  stone: '#9aa8b0',
} as const;

/** The fixed colour of each metric of the statistics. */
export const metricColors: Record<Metric, string> = {
  messages_in: chartColors.brand,
  messages_out: chartColors.blue,
  conversations_active: chartColors.violet,
  new_contacts: chartColors.green,
  handoffs: chartColors.orange,
  llm_calls: chartColors.slate,
  charged_micro: chartColors.gold,
};

/** Reasons for a handoff are categories, not metrics: their own distinct hues. */
export const reasonColors: Record<string, string> = {
  contact_request: chartColors.blue,
  assistant: chartColors.violet,
  failures: chartColors.orange,
};
