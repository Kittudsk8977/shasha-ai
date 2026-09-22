import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reserveCredits, refundCredits, InsufficientCreditsError } from '@/lib/credits';
import { runGeneration } from '@/lib/ai/providerRegistry';
import { moderateInput } from '@/lib/moderation';
import { checkRateLimit } from '@/lib/rateLimit';

const requestSchema = z.object({
  mode: z.enum(['text-to-video', 'image-to-video']),
  prompt: z.string().min(1).max(2000),
  referenceImageUrl: z.string().url().optional(),
  durationSeconds: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30), z.literal(60)]),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  projectId: z.string().optional()
});

function toolKeyFor(durationSeconds: number) {
  return `video.generate.${durationSeconds}s`;
}

export async function POST(req: NextRequest) {
  const user = await getServerAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const rate = await checkRateLimit(`generate:video:${user.id}`);
  if (!rate.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const toolKey = toolKeyFor(input.durationSeconds);

  const moderation = await moderateInput(input.prompt);
  if (moderation === 'BLOCKED') {
    return NextResponse.json({ error: 'This prompt isn\'t allowed.' }, { status: 422 });
  }

  let reservation;
  try {
    reservation = await reserveCredits(user.id, toolKey);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: 'You don\'t have enough credits.', required: err.required, available: err.available },
        { status: 402 }
      );
    }
    throw err;
  }

  // Video jobs stay QUEUED/PROCESSING and are resolved later by a poller —
  // the client is expected to hit GET /api/v1/jobs/[id], never assume success here.
  const job = await prisma.generationJob.create({
    data: {
      userId: user.id,
      projectId: input.projectId,
      toolKey,
      category: 'VIDEO',
      status: 'QUEUED',
      input,
      creditsCost: reservation.creditsCost,
      moderationResult: moderation
    }
  });

  const { result, providerId } = await runGeneration('VIDEO', { toolKey, userId: user.id, input });

  if (!result.success) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorMessage: result.errorMessage, providerId }
    });
    await refundCredits(job.id);
    return NextResponse.json(
      { error: 'Generation failed. Your credits have been refunded.', jobId: job.id },
      { status: 502 }
    );
  }

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: 'PROCESSING', providerId }
  });

  return NextResponse.json({
    jobId: job.id,
    status: 'PROCESSING',
    pollUrl: `/api/v1/jobs/${job.id}`,
    creditsCharged: reservation.creditsCost
  });
}
