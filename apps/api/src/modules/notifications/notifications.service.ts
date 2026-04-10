import { Injectable } from "@nestjs/common";

@Injectable()
export class NotificationsService {
  list() {
    return {
      items: [],
      unreadCount: 0,
    };
  }
}
