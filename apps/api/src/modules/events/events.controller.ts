import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";

import { CurrentUserId } from "../../common/current-user";
import { OptionalUser } from "../../common/current-user";
import { Public } from "../../common/public-route";
import { SetEventParticipationDto } from "./dto/set-event-participation.dto";
import { EventsService } from "./events.service";

function toArray(value?: string | string[]) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get("favorites")
  listFavorites(@CurrentUserId() userId: string) {
    return this.eventsService.listFavorites(userId);
  }

  @Get("friends")
  listFriendsEvents(@CurrentUserId() userId: string) {
    return this.eventsService.listFriendsEvents(userId);
  }

  @Get()
  @Public()
  listEvents(
    @OptionalUser() user: { userId: string } | null,
    @Query("q") q?: string,
    @Query("sport") sport?: string,
    @Query("region") region?: string,
    @Query("city") city?: string | string[],
    @Query("category") category?: string | string[],
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("sort") sort?: string,
    @Query("includePast") includePast?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.eventsService.list(
      {
        q,
        sport,
        region,
        cities: toArray(city),
        categories: toArray(category),
        dateFrom,
        dateTo,
        sort: sort === "popular" ? "popular" : "date_asc",
        includePast: includePast === "true",
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
