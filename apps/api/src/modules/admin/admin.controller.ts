import { Controller, Post } from "@nestjs/common";

import { Roles } from "../../common/roles";
import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post("events/sync")
  @Roles("admin")
  syncEvents() {
    return this.adminService.syncEvents();
  }
}
