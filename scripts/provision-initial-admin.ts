import 'dotenv/config';
import { AppError } from '../src/errors/app-error';
import { prisma } from '../src/lib/prisma';
import { PrismaAdminManagementRepository } from '../src/modules/admin-management/admin-management.repository';
import {
  assertExpectedDatabase,
  provisionInitialAdmin,
} from '../src/modules/admin-management/initial-admin-provisioning';

async function main(): Promise<void> {
  const {
    INITIAL_ADMIN_EMAIL,
    INITIAL_ADMIN_NAME,
    INITIAL_ADMIN_PASSWORD,
    INITIAL_ADMIN_EXPECTED_DATABASE,
  } = process.env;
  if (
    !INITIAL_ADMIN_EMAIL ||
    !INITIAL_ADMIN_NAME ||
    !INITIAL_ADMIN_PASSWORD ||
    !INITIAL_ADMIN_EXPECTED_DATABASE
  ) {
    throw new AppError(
      400,
      'MISSING_PROVISIONING_INPUT',
      'Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, INITIAL_ADMIN_PASSWORD, and INITIAL_ADMIN_EXPECTED_DATABASE in the process environment',
    );
  }

  try {
    const [identity] = await prisma.$queryRaw<
      { database_name: string }[]
    >`SELECT current_database() AS database_name`;
    if (!identity) {
      throw new AppError(
        503,
        'PROVISIONING_DATABASE_UNAVAILABLE',
        'Could not verify the connected database; no provisioning was performed',
      );
    }
    assertExpectedDatabase(
      identity.database_name,
      INITIAL_ADMIN_EXPECTED_DATABASE,
    );

    await provisionInitialAdmin(
      {
        email: INITIAL_ADMIN_EMAIL,
        name: INITIAL_ADMIN_NAME,
        password: INITIAL_ADMIN_PASSWORD,
      },
      new PrismaAdminManagementRepository(prisma),
    );
    console.info('Initial administrator provisioning completed.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    if (error instanceof AppError) {
      console.error(`${error.code}: ${error.message}`);
    } else {
      console.error(
        `INITIAL_ADMIN_PROVISIONING_FAILED: ${error instanceof Error ? error.name : 'UnknownError'}. No recovery writes were attempted. Inspect database state before retrying.`,
      );
    }
    process.exitCode = 1;
  });
}
