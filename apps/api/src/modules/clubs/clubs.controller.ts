import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { ClubsService, CreateClubDto } from "./clubs.service";

@Controller("clubs")
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  listClubs() {
    return this.clubsService.list();
  }

  @Post()
  createClub(@Body() dto: CreateClubDto) {
    return this.clubsService.create(dto);
  }

  @Get(":clubId")
  getClub(@Param("clubId") clubId: string) {
    return this.clubsService.getOne(clubId);
  }

  @Patch(":clubId")
  updateClub(@Param("clubId") clubId: string, @Body() dto: Partial<CreateClubDto>) {
    return this.clubsService.update(clubId, dto);
  }

  @Post(":clubId/members")
  joinClub(@Param("clubId") clubId: string) {
    return this.clubsService.join(clubId);
  }
}
