import { IsIn } from "class-validator";

export class SetEventParticipationDto {
  @IsIn(["interested", "going"])
  status!: "interested" | "going";
}
