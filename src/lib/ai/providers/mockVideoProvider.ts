import type { AiProviderAdapter } from '../types';

/**
 * TEMPLATE ADAPTER for text-to-video / image-to-video.
 * Video providers are usually async (job submitted, polled later) —
 * model that by returning success immediately with a `pending` marker
 * in rawProviderResponse, and have a background poller update the
 * GenerationJob row when the provider reports completion.
 */
export const mockVideoProvider: AiProviderAdapter = {
  key: 'mock-video',
  category: 'VIDEO',

  async healthCheck() {
    return 'ONLINE';
  },

  async generate(request) {
    const prompt = String(request.input.prompt ?? '');
    if (!prompt.trim()) {
      return { success: false, errorMessage: 'Prompt is required.' };
    }

    // Real providers (e.g. Runway, Luma) typically return a job id here,
    // which you'd store on GenerationJob and poll via a queue/cron —
    // never keep an HTTP request open for a multi-minute video render.
    return {
      success: true,
      outputUrl: undefined,
      rawProviderResponse: { providerJobId: `mock-${Date.now()}`, status: 'pending' }
    };
  }
};
