import 'dotenv/config';
import { loadConfig } from '../src/config/env';
import { createLogger } from '../src/lib/logger';
import { PrismaNotificationOutboxRepository } from '../src/modules/notifications/notification-outbox.repository';
import { NotificationOutboxService } from '../src/modules/notifications/notification-outbox.service';
import { NotificationWorker } from '../src/modules/notifications/notification-worker.runner';
import { createEmailProvider } from '../src/modules/notifications/providers/email.provider';
import { createWhatsAppProvider } from '../src/modules/notifications/providers/whatsapp.provider';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const logger = createLogger(config.LOG_LEVEL);

  logger.info(
    {
      env: config.NODE_ENV,
      emailProvider: config.EMAIL_PROVIDER,
      hasWhatsAppToken: Boolean(config.WHATSAPP_API_TOKEN),
      batchSize: config.NOTIFICATION_WORKER_BATCH_SIZE,
    },
    'Initializing notification outbox worker',
  );

  const outboxRepo = new PrismaNotificationOutboxRepository();
  const emailProvider = createEmailProvider(config, false);
  const whatsappProvider = createWhatsAppProvider(config, false);

  const service = new NotificationOutboxService(
    outboxRepo,
    emailProvider,
    whatsappProvider,
    config.STORE_OWNER_WHATSAPP_NUMBER,
    config.EMAIL_FROM,
    logger,
  );

  const worker = new NotificationWorker({
    notificationService: service,
    batchSize: config.NOTIFICATION_WORKER_BATCH_SIZE,
    pollIntervalMs: 5_000,
    logger,
  });

  const isRunOnce =
    process.argv.includes('--once') || process.argv.includes('-1');

  if (isRunOnce) {
    logger.info('Running notification worker in single-batch mode (--once)');
    const result = await worker.processOnce();
    logger.info(result, 'Single batch completed');
    process.exit(0);
  }

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received, stopping worker...');
    await worker.stop(10_000);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  await worker.start();
}

if (
  require.main === module ||
  process.argv[1]?.includes('notification-worker')
) {
  main().catch((err: unknown) => {
    console.error('Fatal notification worker error:', err);
    process.exit(1);
  });
}
