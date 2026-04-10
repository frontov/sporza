import { Injectable, OnModuleInit } from "@nestjs/common";

import { QueueService, StravaSyncJobPayload } from "../../infrastructure/queue/queue.service";
import { StravaService } from "./strava.service";

@Injectable()
export class StravaProcessor implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly stravaService: StravaService,
  ) {}

  onModuleInit() {
    this.queueService.registerStravaWorker(async (payload) => {
      await this.process(payload);
    });

    void this.queueService.enqueueStravaSyncJob(
      {
        mode: "scan_due_connections",
      },
      {
        repeat: {
          every: 15 * 60 * 1000,
        },
        jobId: "strava-scan-due-connections",
      },
    );
  }

  private async process(payload: StravaSyncJobPayload) {
    if (payload.mode === "scan_due_connections") {
      await this.stravaService.enqueueDueConnections();
      return;
    }

    const userId = payload.connectionUserId ?? payload.userId;

    if (!userId) {
      return;
    }

    await this.stravaService.syncConnection(userId, payload.mode);
  }
}
