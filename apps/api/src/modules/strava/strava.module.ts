import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { StravaController } from "./strava.controller";
import { StravaProcessor } from "./strava.processor";
import { StravaService } from "./strava.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [StravaController],
  providers: [StravaService, StravaProcessor],
  exports: [StravaService],
})
export class StravaModule {}
