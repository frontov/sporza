import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getRoot() {
    return {
      service: "sporza-api",
      version: "0.1.0",
      docsPath: "/docs",
      apiPrefix: "/v1",
      status: "ok",
    };
  }
}
