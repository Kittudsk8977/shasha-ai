import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? ''
    })
  : null;

// 20 requests per minute per key by default — tune per route as needed.
const limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m') })
  : null;

export async function checkRateLimit(key: string): Promise<{ allowed: boolean }> {
  if (!limiter) {
    // No Redis configured yet (e.g. local dev) — fail open, but log loudly.
    console.warn('Rate limiting is disabled: UPSTASH_REDIS_REST_URL is not set.');
    return { allowed: true };
  }
  const { success } = await limiter.limit(key);
  return { allowed: success };
}
