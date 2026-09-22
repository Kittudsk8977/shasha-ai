import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reserveCredits, refundCredits, InsufficientCreditsError } from '@/lib/credits';
import { moderateInput } from '@/lib/moderation';
import { checkRateLimit } from '@/lib/rateLimit';

const requestSchema = z.object({
  songIdea: z.string().min(1).max(2000),
  lyrics: z.string().max(4000).optional(),
  genre: z.string(),
  mood: z.string().optional(),
  durationSeconds: z.number().min(15).max(240).default(60),
  projectId: z.string().optional()
});

const TOOL_KEY = 'music.song';

export async function POST(req: NextRequest) {
  const user = await getServerAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const rate = await checkRateLimit(`generate:music:${user.id}`);
  if (!rate.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const moderation = await moderateInput(`${input.songIdea} ${input.lyrics ?? ''}`);
  if (moderation === 'BLOCKED') {
    return NextResponse.json({ error: 'This request isn\'t allowed.' }, { status: 422 });
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
      projectId: input.projectId,
      toolKey: TOOL_KEY,
      category: 'MUSIC',
      status: 'PROCESSING',
      input,
      creditsCost: reservation.creditsCost,
      moderationResult: moderation
    }
  });

  // TODO: register a real music provider adapter and call it via
  // runGeneration('MUSIC', ...), same as the image route does.
  // Always surface the provider's own licensing terms to the user
  // alongside the result — never claim commercial rights the
  // provider's terms don't actually grant.

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: 'FAILED', errorMessage: 'No music provider configured yet.' }
  });
  await refundCredits(job.id);

  return NextResponse.json(
    { error: 'No music provider is configured yet. Credits refunded.', jobId: job.id },
    { status: 502 }
  );
}
