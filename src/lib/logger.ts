import pino, { type Logger, type LevelWithSilent } from 'pino';

export function createLogger(level: LevelWithSilent): Logger {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
      ],
      censor: '[REDACTED]',
    },
  });
}
