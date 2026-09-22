/**
 * Shared contract every AI provider adapter must implement.
 * The rest of the app (API routes, job runner) only ever talks
 * to this interface — never to a specific vendor SDK directly.
 * This is what lets you add/remove/fallback providers via the
 * admin panel without touching route code.
 */

export type AiCategory = 'IMAGE' | 'VIDEO' | 'VOICE' | 'MUSIC' | 'TEXT';

export interface GenerationRequest {
  toolKey: string;
  userId: string;
  input: Record<string, unknown>;
}

export interface GenerationResult {
  success: boolean;
  outputUrl?: string;          // storage key/URL of the generated asset
  rawProviderResponse?: unknown;
  errorMessage?: string;
}

export interface AiProviderAdapter {
  key: string;                 // must match AiProvider.key in the database
  category: AiCategory;

  /** Cheap, fast check used by the health monitor — should not consume credits/quota. */
  healthCheck(): Promise<'ONLINE' | 'DEGRADED' | 'OFFLINE'>;

  /** Perform the actual generation. Must throw on hard failure so the
   *  registry can retry or fall back to the next provider. */
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
