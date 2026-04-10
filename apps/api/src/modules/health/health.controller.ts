import { Controller, Get } from "@nestjs/common";

import { Public } from "../../common/public-route";
import { DatabaseService } from "../../infrastructure/database/database.service";

@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  @Public()
  async getHealth() {
    let database = "up";

    try {
      await this.databaseService.ping();
    } catch {
      database = "down";
    }

    return {
      status: database === "up" ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        api: "up",
        database,
        redis: "pending",
        storage: "pending",
      },
    };
  }
}
