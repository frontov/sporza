import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";

import { CurrentUserId } from "../../common/current-user";
import { Public } from "../../common/public-route";
import { StravaService } from "./strava.service";

@Controller("strava")
export class StravaController {
  constructor(private readonly stravaService: StravaService) {}

  @Get("status")
  getStatus(@CurrentUserId() userId: string) {
    return this.stravaService.getConnectionStatus(userId);
  }

  @Get("webhook")
  @Public()
  verifyWebhook(
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") verifyToken?: string,
    @Query("hub.challenge") challenge?: string,
  ) {
    return this.stravaService.handleWebhookValidation(mode, verifyToken, challenge);
  }

  @Post("webhook")
  @Public()
  receiveWebhook(
    @Body()
    body: {
      aspect_type?: "create" | "update" | "delete";
      event_time?: number;
      object_id?: number;
      object_type?: "activity" | "athlete";
      owner_id?: number;
      subscription_id?: number;
      updates?: Record<string, string>;
    },
  ) {
    return this.stravaService.handleWebhookEvent(body);
  }

  @Post("connect-url")
  getConnectUrl(@CurrentUserId() userId: string) {
    return this.stravaService.createConnectUrl(userId);
  }

  @Post("connect")
  connect(
    @CurrentUserId() userId: string,
    @Body() dto: { code: string; state: string },
  ) {
    return this.stravaService.connect(userId, dto.code, dto.state);
  }

  @Post("sync")
  syncNow(@CurrentUserId() userId: string) {
    return this.stravaService.enqueueManualSync(userId);
  }

  @Post("webhook/ensure")
  ensureWebhook() {
    return this.stravaService.ensureWebhookSubscription();
  }

  @Delete("disconnect")
  disconnect(@CurrentUserId() userId: string) {
    return this.stravaService.disconnect(userId);
  }
}
