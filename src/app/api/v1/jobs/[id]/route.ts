import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerAuthUser } from '@/lib/auth';

/**
 * The frontend should poll this endpoint (e.g. every 2-3s) for any job
 * that isn't synchronous, rather than assuming a generation succeeded.
 * Never expose another user's job by id — always scope by userId.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getServerAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const job = await prisma.generationJob.findFirst({
    where: { id: params.id, userId: user.id }
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    outputUrl: job.outputUrl,
    errorMessage: job.errorMessage,
    creditsCost: job.creditsCost,
    createdAt: job.createdAt,
    completedAt: job.completedAt
  });
}
