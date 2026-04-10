import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { CurrentUserId } from "../../common/current-user";
import { OptionalUser } from "../../common/current-user";
import { Public } from "../../common/public-route";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateActivityPrivacyDto } from "./dto/update-activity-privacy.dto";
import { ActivitiesService } from "./activities.service";

@Controller("activities")
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  listActivities(@CurrentUserId() userId: string, @Query("cursor") cursor?: string) {
    return this.activitiesService.list(userId, cursor);
  }

  @Get(":activityId")
  @Public()
  getActivity(@Param("activityId") activityId: string, @OptionalUser() user: { userId: string } | null) {
    return this.activitiesService.getOne(activityId, user?.userId);
  }

  @Delete(":activityId")
  deleteActivity(@CurrentUserId() userId: string, @Param("activityId") activityId: string) {
    return this.activitiesService.remove(userId, activityId);
  }

  @Patch(":activityId/privacy")
  updatePrivacy(
    @CurrentUserId() userId: string,
    @Param("activityId") activityId: string,
    @Body() dto: UpdateActivityPrivacyDto,
  ) {
    return this.activitiesService.updatePrivacy(userId, activityId, dto.visibility);
  }

  @Post(":activityId/likes")
  likeActivity(@CurrentUserId() userId: string, @Param("activityId") activityId: string) {
    return this.activitiesService.like(userId, activityId);
  }

  @Delete(":activityId/likes")
  unlikeActivity(@CurrentUserId() userId: string, @Param("activityId") activityId: string) {
    return this.activitiesService.unlike(userId, activityId);
  }

  @Get(":activityId/comments")
  listComments(@Param("activityId") activityId: string) {
    return this.activitiesService.listComments(activityId);
  }

  @Post(":activityId/comments")
  createComment(
    @CurrentUserId() userId: string,
    @Param("activityId") activityId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.activitiesService.createComment(userId, activityId, dto.body);
  }
}
