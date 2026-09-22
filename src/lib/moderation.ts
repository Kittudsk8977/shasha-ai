export type ModerationDecision = 'ALLOWED' | 'REVIEW' | 'BLOCKED';

/**
 * TEMPLATE — replace with a real moderation provider call
 * (e.g. OpenAI's moderation endpoint, or a custom classifier).
 * Keep this behind its own function so the check can be swapped
 * without touching any generation route.
 */
export async function moderateInput(text: string): Promise<ModerationDecision> {
  const lower = text.toLowerCase();

  // Placeholder heuristic only — do not ship this as your real moderation layer.
  const hardBlockedTerms = ['csam', 'child sexual'];
  if (hardBlockedTerms.some((t) => lower.includes(t))) {
    return 'BLOCKED';
  }

  // TODO: call a real moderation provider here, e.g.:
  // const res = await fetch('https://api.openai.com/v1/moderations', { ... });
  // return mapProviderResponseToDecision(await res.json());

  return 'ALLOWED';
}
