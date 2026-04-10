import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JobsOptions, Queue, Worker } from "bullmq";
import IORedis from "ioredis";

export type ImportJobPayload = {
  importJobId: string;
  userId: string;
  storageKey: string;
  originalFilename: string;
  fileType: string;
  fileHash: string;
};

export type StravaSyncJobPayload = {
  userId?: string;
  connectionUserId?: string;
  mode: "initial_backfill" | "incremental" | "scan_due_connections";
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly importQueue: Queue<ImportJobPayload>;
  private readonly stravaQueue: Queue<StravaSyncJobPayload>;
  private readonly queueName: string;
  private readonly stravaQueueName: string;
  private importWorker?: Worker<ImportJobPayload>;
  private stravaWorker?: Worker<StravaSyncJobPayload>;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.queueName = this.configService.get<string>("IMPORT_QUEUE_NAME") ?? "activity-imports";
    this.stravaQueueName = this.configService.get<string>("STRAVA_SYNC_QUEUE_NAME") ?? "strava-sync";
    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.importQueue = new Queue<ImportJobPayload>(this.queueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 100,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    });
    this.stravaQueue = new Queue<StravaSyncJobPayload>(this.stravaQueueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 100,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });
  }

  async enqueueImportJob(payload: ImportJobPayload, options?: JobsOptions) {
    await this.importQueue.add("process-import", payload, options);
  }

  async enqueueStravaSyncJob(payload: StravaSyncJobPayload, options?: JobsOptions) {
    await this.stravaQueue.add(`strava-${payload.mode}`, payload, options);
  }

  registerImportWorker(processor: (payload: ImportJobPayload) => Promise<void>) {
    if (this.importWorker) {
      return this.importWorker;
    }

    this.importWorker = new Worker<ImportJobPayload>(
      this.queueName,
      async (job) => {
        await processor(job.data);
      },
      {
        connection: this.connection,
      },
    );

    return this.importWorker;
  }

  registerStravaWorker(processor: (payload: StravaSyncJobPayload) => Promise<void>) {
    if (this.stravaWorker) {
      return this.stravaWorker;
    }

    this.stravaWorker = new Worker<StravaSyncJobPayload>(
      this.stravaQueueName,
      async (job) => {
        await processor(job.data);
      },
      {
        connection: this.connection,
      },
    );

    return this.stravaWorker;
  }

  async onModuleDestroy() {
    if (this.importWorker) {
      await this.importWorker.close();
    }

    if (this.stravaWorker) {
      await this.stravaWorker.close();
    }

    await this.importQueue.close();
    await this.stravaQueue.close();
    await this.connection.quit();
  }
}
