import type { Logger } from 'pino';
import type { NotificationOutboxService } from './notification-outbox.service';

export interface NotificationWorkerOptions {
  notificationService: NotificationOutboxService;
  batchSize?: number;
  pollIntervalMs?: number;
  logger?: Logger;
}

export interface WorkerMetrics {
  isRunning: boolean;
  totalBatches: number;
  totalDelivered: number;
  totalFailed: number;
  lastRunAt: Date | null;
  consecutiveEmptyBatches: number;
}

export class NotificationWorker {
  private readonly notificationService: NotificationOutboxService;
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly logger?: Logger;

  private isRunning = false;
  private isProcessing = false;
  private stopRequested = false;
  private timer: NodeJS.Timeout | null = null;
  private currentBatchPromise: Promise<void> | null = null;

  private totalBatches = 0;
  private totalDelivered = 0;
  private totalFailed = 0;
  private lastRunAt: Date | null = null;
  private consecutiveEmptyBatches = 0;

  constructor(options: NotificationWorkerOptions) {
    this.notificationService = options.notificationService;
    this.batchSize = options.batchSize ?? 20;
    this.pollIntervalMs = options.pollIntervalMs ?? 5_000;
    this.logger = options.logger;
  }

  getMetrics(): WorkerMetrics {
    return {
      isRunning: this.isRunning,
      totalBatches: this.totalBatches,
      totalDelivered: this.totalDelivered,
      totalFailed: this.totalFailed,
      lastRunAt: this.lastRunAt,
      consecutiveEmptyBatches: this.consecutiveEmptyBatches,
    };
  }

  /**
   * Processes a single batch of pending outbox notifications.
   * Safe to call from cron jobs or manual CLI executions.
   */
  async processOnce(options?: {
    batchSize?: number;
    now?: Date;
  }): Promise<{ processed: number; delivered: number; failed: number }> {
    const limit = options?.batchSize ?? this.batchSize;
    const now = options?.now ?? new Date();

    const result = await this.notificationService.processPendingNotifications({
      batchSize: limit,
      now,
    });

    this.totalBatches++;
    this.totalDelivered += result.delivered;
    this.totalFailed += result.failed;
    this.lastRunAt = new Date();

    if (result.processed === 0) {
      this.consecutiveEmptyBatches++;
    } else {
      this.consecutiveEmptyBatches = 0;
      this.logger?.info(
        {
          processed: result.processed,
          delivered: result.delivered,
          failed: result.failed,
          totalDelivered: this.totalDelivered,
          totalFailed: this.totalFailed,
        },
        'Notification worker processed batch',
      );
    }

    return result;
  }

  /**
   * Starts the continuous background polling loop.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    this.logger?.info(
      { batchSize: this.batchSize, pollIntervalMs: this.pollIntervalMs },
      'Notification worker started',
    );

    const loop = async () => {
      while (this.isRunning && !this.stopRequested) {
        this.isProcessing = true;
        let batchResult = { processed: 0, delivered: 0, failed: 0 };

        try {
          const runPromise = this.processOnce();
          this.currentBatchPromise = runPromise.then(() => undefined);
          batchResult = await runPromise;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Unknown worker error';
          this.logger?.error(
            { error: message },
            'Unexpected error in notification worker loop',
          );
        } finally {
          this.isProcessing = false;
          this.currentBatchPromise = null;
        }

        if (this.stopRequested || !this.isRunning) {
          break;
        }

        // If batch was full, immediately process next batch to drain backlog quickly;
        // otherwise sleep for pollIntervalMs.
        if (batchResult.processed >= this.batchSize) {
          continue;
        }

        await new Promise<void>((resolve) => {
          this.timer = setTimeout(() => {
            this.timer = null;
            resolve();
          }, this.pollIntervalMs);
        });
      }
    };

    // Run loop without unhandled rejection
    loop().catch((err: unknown) => {
      this.logger?.error({ err }, 'Worker loop fatal error');
    });
  }

  /**
   * Gracefully stops the worker, waiting for any in-flight batch to finish.
   */
  async stop(timeoutMs = 10_000): Promise<void> {
    this.stopRequested = true;
    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.isProcessing && this.currentBatchPromise) {
      this.logger?.info(
        'Waiting for in-flight notification batch to finish...',
      );
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error('Worker shutdown timeout exceeded')),
          timeoutMs,
        ),
      );

      try {
        await Promise.race([this.currentBatchPromise, timeoutPromise]);
      } catch (err: unknown) {
        this.logger?.warn(
          { err },
          'Worker stopped while batch was still in flight',
        );
      }
    }

    this.logger?.info(
      {
        totalBatches: this.totalBatches,
        totalDelivered: this.totalDelivered,
        totalFailed: this.totalFailed,
      },
      'Notification worker stopped cleanly',
    );
  }
}
