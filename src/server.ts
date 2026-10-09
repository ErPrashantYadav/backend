import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './app';
import { loadConfig } from './config/env';
import { createLogger } from './lib/logger';
import { prisma } from './lib/prisma';

export function startServer(): Server {
  const config = loadConfig(process.env);
  const logger = createLogger(config.LOG_LEVEL);
  const app = createApp(config);
  const server = app.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, environment: config.NODE_ENV },
      'HTTP server listening',
    );
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown started');
    server.close((error) => {
      void prisma
        .$disconnect()
        .then(() => {
          if (error) {
            logger.error(
              { errorName: error.name },
              'HTTP server shutdown failed',
            );
            process.exitCode = 1;
          }
        })
        .catch(() => {
          logger.error('Database disconnect failed during shutdown');
          process.exitCode = 1;
        });
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown startup error';
    console.error(`Startup refused: ${message}`);
    process.exitCode = 1;
  }
}
