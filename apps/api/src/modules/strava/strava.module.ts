import { Module } from "@nestjs/common";

import { StravaController } from "./strava.controller";
import { StravaProcessor } from "./strava.processor";
import { StravaService } from "./strava.service";

@Module({
  controllers: [StravaController],
  providers: [StravaService, StravaProcessor],
  exports: [StravaService],
})
export class StravaModule {}
