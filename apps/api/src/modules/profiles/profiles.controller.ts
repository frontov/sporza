import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { CurrentUserId } from "../../common/current-user";
import { OptionalUser } from "../../common/current-user";
import { Public } from "../../common/public-route";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ProfilesService } from "./profiles.service";

@Controller()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get("profile/me")
  getMe(@CurrentUserId() userId: string) {
    return this.profilesService.getCurrentProfile(userId);
  }

  @Patch("profile/me")
  updateMe(@CurrentUserId() userId: string, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateCurrentProfile(userId, dto);
  }

  @Post("profile/me/avatar")
  @UseInterceptors(FileInterceptor("file"))
  uploadAvatar(
    @CurrentUserId() userId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Avatar file is required");
    }

    return this.profilesService.uploadAvatar(userId, file);
  }

  @Get("profiles/:username")
  @Public()
  getByUsername(@Param("username") username: string, @OptionalUser() user: { userId: string } | null) {
    return this.profilesService.getPublicProfile(username, user?.userId);
  }

  @Get("profiles")
  @Public()
  searchProfiles(@Query("query") query?: string) {
    return this.profilesService.searchProfiles(query ?? "");
  }
}
