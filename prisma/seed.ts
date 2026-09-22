import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Default generation costs — editable later from the admin panel,
  // never hard-coded anywhere in application code.
  await prisma.generationCost.createMany({
    data: [
      { toolKey: 'image.generate', label: 'AI Image', creditCost: 10 },
      { toolKey: 'video.generate.5s', label: 'AI Video (5s)', creditCost: 30 },
      { toolKey: 'video.generate.10s', label: 'AI Video (10s)', creditCost: 50 },
      { toolKey: 'video.generate.15s', label: 'AI Video (15s)', creditCost: 70 },
      { toolKey: 'video.generate.30s', label: 'AI Video (30s)', creditCost: 120 },
      { toolKey: 'video.generate.60s', label: 'AI Video (60s)', creditCost: 200 },
      { toolKey: 'voice.tts', label: 'AI Voice', creditCost: 5 },
      { toolKey: 'music.song', label: 'AI Song', creditCost: 30 },
      { toolKey: 'text.write', label: 'AI Writing', creditCost: 1 }
    ],
    skipDuplicates: true
  });

  // Default plans — prices/credits here are examples only, per the brief.
  // Change freely; nothing in the codebase assumes these specific values.
  await prisma.plan.createMany({
    data: [
      { key: 'free', name: 'Free', priceMinorUnits: 0, monthlyCredits: 100, sortOrder: 0 },
      { key: 'starter', name: 'Starter', priceMinorUnits: 49900, monthlyCredits: 1000, allowsWatermarkFree: true, sortOrder: 1 },
      { key: 'pro', name: 'Pro', priceMinorUnits: 99900, monthlyCredits: 3000, allowsWatermarkFree: true, sortOrder: 2 },
      { key: 'business', name: 'Business', priceMinorUnits: 249900, monthlyCredits: 10000, allowsWatermarkFree: true, allowsApiAccess: true, sortOrder: 3 }
    ],
    skipDuplicates: true
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
