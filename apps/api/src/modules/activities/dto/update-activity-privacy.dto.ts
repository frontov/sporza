import { IsIn } from "class-validator";

export class UpdateActivityPrivacyDto {
  @IsIn(["public", "followers", "private"])
  visibility!: "public" | "followers" | "private";
}
