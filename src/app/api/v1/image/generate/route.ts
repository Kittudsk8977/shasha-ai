import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reserveCredits, refundCredits, InsufficientCreditsError } from '@/lib/credits';
import { runGeneration } from '@/lib/ai/providerRegistry';
import { moderateInput } from '@/lib/moderation';
import { checkRateLimit } from '@/lib/rateLimit';

const requestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(2000).optional(),
  style: z.string().optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4', '21:9']).default('1:1'),
  projectId: z.string().optional()
});

const TOOL_KEY = 'image.generate';

export async function POST(req: NextRequest) {
  // 1. Auth — never trust a userId from the request body.
  const user = await getServerAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  // 2. Rate limit, independent of credit balance.
  const rate = await checkRateLimit(`generate:image:${user.id}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }

  // 3. Validate input shape.
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // 4. Moderate the prompt before spending a single credit.
  const moderation = await moderateInput(input.prompt);
  if (moderation === 'BLOCKED') {
    return NextResponse.json({ error: 'This prompt isn\'t allowed. Please revise it.' }, { status: 422 });
  }

  // 5. Reserve credits atomically — throws if the balance is too low.
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

  // 6. Create the job row up front so status can be polled immediately.
  const job = await prisma.generationJob.create({
    data: {
      userId: user.id,
      projectId: input.projectId,
      toolKey: TOOL_KEY,
      category: 'IMAGE',
      status: 'PROCESSING',
      input,
      creditsCost: reservation.creditsCost,
      moderationResult: moderation
    }
  });

  // 7. Run the generation through the provider abstraction (handles retry/fallback).
  const { result, providerId } = await runGeneration('IMAGE', {
    toolKey: TOOL_KEY,
    userId: user.id,
    input
  });

  if (!result.success) {
    // 8a. Failure — mark the job failed and automatically refund.
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

  // 8b. Success.
  const completed = await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', outputUrl: result.outputUrl, providerId, completedAt: new Date() }
  });

  return NextResponse.json({
    jobId: completed.id,
    status: completed.status,
    outputUrl: completed.outputUrl,
    creditsCharged: reservation.creditsCost
  });
}
