import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Razorpay signs every webhook body with your webhook secret. Verify
 * that signature before trusting anything in the payload — a payment
 * is only ever "confirmed" here, never from a client-side redirect.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set.');
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected !== signature) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  switch (event.event) {
    case 'subscription.activated':
    case 'subscription.charged': {
      const providerSubId = event.payload.subscription.entity.id;
      const subscription = await prisma.subscription.findFirst({ where: { providerSubId } });
      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'ACTIVE' }
        });
        // TODO: also credit the plan's monthlyCredits and create an Invoice row here.
      }
      break;
    }
    case 'subscription.cancelled': {
      const providerSubId = event.payload.subscription.entity.id;
      await prisma.subscription.updateMany({
        where: { providerSubId },
        data: { status: 'CANCELLED' }
      });
      break;
    }
    case 'payment.failed': {
      // TODO: mark the relevant Invoice as FAILED and notify the user.
      break;
    }
    default:
      // Unhandled event types are fine to ignore, but log them during setup
      // so you notice anything you should be handling.
      console.log('Unhandled Razorpay event:', event.event);
  }

  return NextResponse.json({ received: true });
}
