import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { CurrentUserId } from "../../common/current-user";
import { ImportsService } from "./imports.service";

@Controller("imports")
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  listJobs(@CurrentUserId() userId: string) {
    return this.importsService.listJobs(userId);
  }

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  createImport(@CurrentUserId() userId: string, @UploadedFile() file: Express.Multer.File) {
    return this.importsService.createJob(userId, file);
  }

  @Get(":jobId")
  getJob(@CurrentUserId() userId: string, @Param("jobId") jobId: string) {
    return this.importsService.getJob(userId, jobId);
  }
}
