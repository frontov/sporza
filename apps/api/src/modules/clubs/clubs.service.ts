import { Injectable } from "@nestjs/common";

export interface CreateClubDto {
  name: string;
  city?: string;
  sportType?: string;
  description?: string;
}

@Injectable()
export class ClubsService {
  list() {
    return {
      items: [],
    };
  }

  create(dto: CreateClubDto) {
    return {
      id: "club-stub",
      ...dto,
    };
  }

  getOne(clubId: string) {
    return {
      id: clubId,
      name: "Sporza Runners",
      membersCount: 1,
    };
  }

  update(clubId: string, dto: Partial<CreateClubDto>) {
    return {
      id: clubId,
      patch: dto,
    };
  }

  join(clubId: string) {
    return {
      clubId,
      membership: "joined",
    };
  }
}
