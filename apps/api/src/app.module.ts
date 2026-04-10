import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AdminModule } from "./modules/admin/admin.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ActivitiesModule } from "./modules/activities/activities.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ClubsModule } from "./modules/clubs/clubs.module";
import { EventsModule } from "./modules/events/events.module";
import { FeedModule } from "./modules/feed/feed.module";
import { FollowsModule } from "./modules/follows/follows.module";
import { HealthModule } from "./modules/health/health.module";
import { AppConfigModule } from "./infrastructure/config/app-config.module";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { QueueModule } from "./infrastructure/queue/queue.module";
import { StorageModule } from "./infrastructure/storage/storage.module";
import { ImportsModule } from "./modules/imports/imports.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { StravaModule } from "./modules/strava/strava.module";
import { JwtAuthGuard } from "./modules/auth/jwt-auth.guard";
import { RolesGuard } from "./modules/auth/roles.guard";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    QueueModule,
    StorageModule,
    HealthModule,
    AuthModule,
    ProfilesModule,
    ActivitiesModule,
    ImportsModule,
    FeedModule,
    FollowsModule,
    ClubsModule,
    EventsModule,
    NotificationsModule,
    StravaModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
