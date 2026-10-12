import 'dotenv/config';
import { AppError } from '../src/errors/app-error';
import { prisma } from '../src/lib/prisma';
import {
  assertExpectedDatabase,
  assertSafeSeedEnvironment,
  PrismaSampleCatalogRepository,
  seedSampleCatalog,
} from '../src/seed/sample-catalog.service';

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');

  assertSafeSeedEnvironment({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    allowProductionSeed: process.env.ALLOW_PRODUCTION_SAMPLE_SEED,
  });

  try {
    const [identity] = await prisma.$queryRaw<
      { database_name: string }[]
    >`SELECT current_database() AS database_name`;

    if (!identity?.database_name) {
      throw new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'Could not verify target database; sample seed aborted',
      );
    }

    assertExpectedDatabase(
      identity.database_name,
      process.env.SAMPLE_SEED_EXPECTED_DATABASE,
    );

    console.info(`[SAMPLE_SEED] Target database: ${identity.database_name}`);
    console.info(`[SAMPLE_SEED] Dry run: ${isDryRun ? 'true' : 'false'}`);

    const repo = new PrismaSampleCatalogRepository(prisma);
    const result = await seedSampleCatalog(repo, { dryRun: isDryRun });

    console.info(
      `[SAMPLE_SEED] Categories upserted: ${result.categoriesUpserted}`,
    );
    console.info(`[SAMPLE_SEED] Brands upserted: ${result.brandsUpserted}`);
    console.info(`[SAMPLE_SEED] Products upserted: ${result.productsUpserted}`);
    console.info(
      `[SAMPLE_SEED] Product variants upserted: ${result.variantsUpserted}`,
    );
    console.info(
      isDryRun
        ? '[SAMPLE_SEED] Dry run completed. No database changes were applied.'
        : '[SAMPLE_SEED] Sample seed completed successfully.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    if (error instanceof AppError) {
      console.error(`[SAMPLE_SEED_ERROR] ${error.code}: ${error.message}`);
    } else {
      console.error(
        `[SAMPLE_SEED_ERROR] SEED_EXECUTION_FAILED: ${error instanceof Error ? error.name : 'UnknownError'}. No partial recovery writes were attempted. Inspect database state before retrying.`,
      );
    }
    process.exitCode = 1;
  });
}

