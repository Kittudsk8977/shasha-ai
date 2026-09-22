import { prisma } from '@/lib/prisma';

/**
 * Every rule in this file runs server-side only. The client never sends
 * a credit amount — it sends a toolKey, and the server looks up the
 * cost itself. This is the only path that is allowed to change a
 * user's creditBalance.
 */

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient credits: need ${required}, have ${available}.`);
  }
}

export async function getToolCost(toolKey: string): Promise<number> {
  const cost = await prisma.generationCost.findUnique({ where: { toolKey } });
  if (!cost || !cost.isActive) {
    throw new Error(`No active price configured for tool "${toolKey}". An admin must add it.`);
  }
  return cost.creditCost;
}

/**
 * Atomically checks and deducts credits in one transaction, so two
 * concurrent requests can't both pass the balance check and overdraw
 * the account. Returns the created (debit) transaction row.
 */
export async function reserveCredits(userId: string, toolKey: string) {
  const cost = await getToolCost(toolKey);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.creditBalance < cost) {
      throw new InsufficientCreditsError(cost, user.creditBalance);
    }

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: cost } }
    });

    const txn = await tx.creditTransaction.create({
      data: { userId, amount: -cost, reason: 'GENERATION_SPEND' }
    });

    return { creditsCost: cost, transactionId: txn.id };
  });
}

/**
 * Called by the job runner when a generation fails after credits were
 * already reserved. Refunds are automatic and idempotent — safe to
 * call more than once for the same job because of the creditsRefunded flag.
 */
export async function refundCredits(jobId: string) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.generationJob.findUniqueOrThrow({ where: { id: jobId } });

    if (job.creditsRefunded) {
      return; // already refunded — never double-refund
    }

    await tx.user.update({
      where: { id: job.userId },
      data: { creditBalance: { increment: job.creditsCost } }
    });

    await tx.creditTransaction.create({
      data: { userId: job.userId, amount: job.creditsCost, reason: 'GENERATION_REFUND', jobId }
    });

    await tx.generationJob.update({
      where: { id: jobId },
      data: { creditsRefunded: true }
    });
  });
}
