import { Controller, Get } from "@nestjs/common";

import { Public } from "./common/public-route";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getRoot() {
    return this.appService.getRoot();
  }
}
