import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerAuthUser } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const user = await getServerAuthUser(req);
  if (!user || user.role !== 'ADMIN') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const providers = await prisma.aiProvider.findMany({ orderBy: { priority: 'asc' } });
  return NextResponse.json({ providers });
}

const upsertSchema = z.object({
  key: z.string(),
  displayName: z.string(),
  category: z.enum(['IMAGE', 'VIDEO', 'VOICE', 'MUSIC', 'TEXT', 'MODERATION']),
  isEnabled: z.boolean(),
  priority: z.number().int().min(0),
  timeoutMs: z.number().int().min(1000),
  maxRetries: z.number().int().min(0).max(5),
  secretRef: z.string() // name of the env var / secrets-manager entry — never the raw key
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', details: parsed.error.flatten() }, { status: 400 });
  }

  const provider = await prisma.aiProvider.upsert({
    where: { key: parsed.data.key },
    update: parsed.data,
    create: parsed.data
  });

  return NextResponse.json({ provider });
}
