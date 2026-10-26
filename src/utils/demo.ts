/** A conversation of the demo: a random identifier the API accepts (8 to 64 letters, digits or dashes). */
export function newDemoSession(): string {
  return `demo-${crypto.randomUUID()}`;
}

export const SESSION_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/** The messages to start with: they use what the sample business knows, and the handoff and approvals. */
export const SUGGESTIONS = [
  '¿Cuánto cuesta la bandeja paisa?',
  '¿A qué hora abren los domingos?',
  '¿Tienen opciones vegetarianas?',
  'Quiero reservar una mesa para 4 mañana a las 8 p. m.',
  'Quiero hablar con una persona',
] as const;

/** How long to wait for an answer, in polls; the model can take a while. */
export const MAX_POLLS = 60;
export const POLL_MS = 1200;
