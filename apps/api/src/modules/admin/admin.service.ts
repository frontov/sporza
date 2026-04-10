import { Injectable } from "@nestjs/common";

import { EventsService } from "../events/events.service";

@Injectable()
export class AdminService {
  constructor(private readonly eventsService: EventsService) {}

  async syncEvents() {
    return this.eventsService.syncExternalEvents();
  }
}
