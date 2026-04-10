import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";

import { CurrentUserId } from "../../common/current-user";
import { OptionalUser } from "../../common/current-user";
import { Public } from "../../common/public-route";
import { SetEventParticipationDto } from "./dto/set-event-participation.dto";
import { EventsService } from "./events.service";

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get("favorites")
  listFavorites(@CurrentUserId() userId: string) {
    return this.eventsService.listFavorites(userId);
  }

  @Get()
  @Public()
  listEvents(
    @OptionalUser() user: { userId: string } | null,
    @Query("sport") sport?: string,
    @Query("region") region?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.eventsService.list(
      {
        sport,
        region,
        dateFrom,
        dateTo,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      user?.userId,
    );
  }

  @Get(":eventId")
  @Public()
  getEvent(@Param("eventId") eventId: string, @OptionalUser() user: { userId: string } | null) {
    return this.eventsService.getOne(eventId, user?.userId);
  }

  @Get(":eventId/chat")
  @Public()
  getChat(@Param("eventId") eventId: string) {
    return this.eventsService.listChatMessages(eventId);
  }

  @Post(":eventId/chat")
  createChatMessage(
    @CurrentUserId() userId: string,
    @Param("eventId") eventId: string,
    @Body("body") body: string,
  ) {
    return this.eventsService.createChatMessage(userId, eventId, body);
  }

  @Put(":eventId/favorite")
  addFavorite(@CurrentUserId() userId: string, @Param("eventId") eventId: string) {
    return this.eventsService.addFavorite(userId, eventId);
  }

  @Delete(":eventId/favorite")
  removeFavorite(@CurrentUserId() userId: string, @Param("eventId") eventId: string) {
    return this.eventsService.removeFavorite(userId, eventId);
  }

  @Put(":eventId/participation")
  setParticipation(
    @CurrentUserId() userId: string,
    @Param("eventId") eventId: string,
    @Body() dto: SetEventParticipationDto,
  ) {
    return this.eventsService.setParticipation(userId, eventId, dto.status);
  }

  @Delete(":eventId/participation")
  removeParticipation(@CurrentUserId() userId: string, @Param("eventId") eventId: string) {
    return this.eventsService.removeParticipation(userId, eventId);
  }
}
