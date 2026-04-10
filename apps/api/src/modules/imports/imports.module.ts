import { Module } from "@nestjs/common";

import { ImportsController } from "./imports.controller";
import { ImportsProcessor } from "./imports.processor";
import { ImportsService } from "./imports.service";

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, ImportsProcessor],
})
export class ImportsModule {}
