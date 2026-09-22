import { prisma } from '@/lib/prisma';
import type { AiProviderAdapter, AiCategory, GenerationRequest, GenerationResult } from './types';

/**
 * Register every real adapter here. Swapping vendors, adding a new one,
 * or running two side by side is just adding/removing an entry —
 * nothing else in the app changes.
 *
 * Example real adapters to add once you have provider accounts:
 *   import { openAiImageAdapter } from './providers/openAiImage';
 *   import { stabilityImageAdapter } from './providers/stabilityImage';
 *   import { elevenLabsVoiceAdapter } from './providers/elevenLabsVoice';
 */
import { mockImageProvider } from './providers/mockImageProvider';
import { mockVideoProvider } from './providers/mockVideoProvider';

const ADAPTERS: AiProviderAdapter[] = [mockImageProvider, mockVideoProvider];

function getAdapter(key: string): AiProviderAdapter | undefined {
  return ADAPTERS.find((a) => a.key === key);
}

/**
 * Picks the highest-priority enabled, healthy provider for a category,
 * runs the generation, and falls back to the next provider on failure.
 * This function assumes credits have ALREADY been checked/reserved by
 * the caller — it never touches the credit ledger itself.
 */
export async function runGeneration(
  category: AiCategory,
  request: GenerationRequest
): Promise<{ result: GenerationResult; providerId: string | null }> {
  const candidates = await prisma.aiProvider.findMany({
    where: { category, isEnabled: true },
    orderBy: { priority: 'asc' }
  });

  if (candidates.length === 0) {
    return {
      providerId: null,
      result: { success: false, errorMessage: `No enabled provider configured for ${category}.` }
    };
  }

  let lastError = 'Unknown error';

  for (const providerRow of candidates) {
    const adapter = getAdapter(providerRow.key);
    if (!adapter) {
      lastError = `No adapter code registered for provider "${providerRow.key}".`;
      continue;
    }

    for (let attempt = 0; attempt <= providerRow.maxRetries; attempt++) {
      try {
        const result = await withTimeout(adapter.generate(request), providerRow.timeoutMs);
        if (result.success) {
          return { providerId: providerRow.id, result };
        }
        lastError = result.errorMessage ?? 'Provider returned failure.';
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Provider threw an unexpected error.';
      }
    }
    // this provider exhausted its retries — fall through to the next one, if any
  }

  return { providerId: null, result: { success: false, errorMessage: lastError } };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Provider timed out')), ms))
  ]);
}
