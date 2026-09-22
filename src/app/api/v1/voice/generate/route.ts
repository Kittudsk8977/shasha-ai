import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reserveCredits, refundCredits, InsufficientCreditsError } from '@/lib/credits';
import { moderateInput } from '@/lib/moderation';
import { checkRateLimit } from '@/lib/rateLimit';

const requestSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string(),
  language: z.string().default('en'),
  speed: z.number().min(0.5).max(2).default(1),
  // Voice CLONING (as opposed to picking a stock voice) must never be allowed
  // without the speaker's explicit, verifiable consent. Enforce that upstream
  // of this route — e.g. requiring a signed consent record id here:
  clonedVoiceConsentId: z.string().optional()
});

const TOOL_KEY = 'voice.tts';

export async function POST(req: NextRequest) {
  const user = await getServerAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const rate = await checkRateLimit(`generate:voice:${user.id}`);
  if (!rate.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const moderation = await moderateInput(input.text);
  if (moderation === 'BLOCKED') {
    return NextResponse.json({ error: 'This text isn\'t allowed.' }, { status: 422 });
  }

  let reservation;
  try {
    reservation = await reserveCredits(user.id, TOOL_KEY);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: 'You don\'t have enough credits.', required: err.required, available: err.available },
        { status: 402 }
      );
    }
    throw err;
  }

  const job = await prisma.generationJob.create({
    data: {
      userId: user.id,
      toolKey: TOOL_KEY,
      category: 'VOICE',
      status: 'PROCESSING',
      input,
      creditsCost: reservation.creditsCost,
      moderationResult: moderation
    }
  });

  // TODO: call the voice provider through the same runGeneration('VOICE', ...)
  // pattern used in the image route once a real voice adapter is registered.

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: 'FAILED', errorMessage: 'No voice provider configured yet.' }
  });
  await refundCredits(job.id);

  return NextResponse.json(
    { error: 'No voice provider is configured yet. Credits refunded.', jobId: job.id },
    { status: 502 }
  );
}
