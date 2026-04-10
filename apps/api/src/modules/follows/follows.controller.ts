import { Controller, Delete, Get, Param, Post } from "@nestjs/common";

import { CurrentUserId } from "../../common/current-user";
import { FollowsService } from "./follows.service";

@Controller("follows")
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get("following")
  listFollowing(@CurrentUserId() userId: string) {
    return this.followsService.listFollowing(userId);
  }

  @Get("followers")
  listFollowers(@CurrentUserId() userId: string) {
    return this.followsService.listFollowers(userId);
  }

  @Post(":userId")
  follow(@CurrentUserId() currentUserId: string, @Param("userId") userId: string) {
    return this.followsService.follow(currentUserId, userId);
  }

  @Delete(":userId")
  unfollow(@CurrentUserId() currentUserId: string, @Param("userId") userId: string) {
    return this.followsService.unfollow(currentUserId, userId);
  }
}
