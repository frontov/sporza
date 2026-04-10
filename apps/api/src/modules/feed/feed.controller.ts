import { Controller, Get, Query } from "@nestjs/common";

import { CurrentUserId } from "../../common/current-user";
import { FeedService } from "./feed.service";

@Controller("feed")
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  getFeed(@CurrentUserId() userId: string, @Query("cursor") cursor?: string) {
    return this.feedService.getFeed(userId, cursor);
  }
}
