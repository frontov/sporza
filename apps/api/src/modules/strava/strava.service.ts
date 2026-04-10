import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "node:crypto";

import { DatabaseService } from "../../infrastructure/database/database.service";
import { QueueService } from "../../infrastructure/queue/queue.service";

type StravaConnectionRow = {
  user_id: string;
  athlete_id: number;
  athlete_username: string | null;
  athlete_full_name: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: Date | string;
  status: "active" | "revoked" | "error";
  last_backfill_started_at: Date | string | null;
  last_backfill_finished_at: Date | string | null;
  last_sync_started_at: Date | string | null;
  last_sync_finished_at: Date | string | null;
  last_synced_activity_at: Date | string | null;
  last_error: string | null;
};

type StravaTokenResponse = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: {
    id: number;
    username?: string | null;
    firstname?: string | null;
    lastname?: string | null;
  };
};

type StravaActivity = {
  id: number;
  name: string;
  type: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance: number | null;
  total_elevation_gain: number | null;
  average_heartrate?: number | null;
  calories?: number | null;
};

type StravaStreamsResponse = {
  latlng?: {
    data: Array<[number, number]>;
  };
};

@Injectable()
export class StravaService {
  private readonly logger = new Logger(StravaService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async getConnectionStatus(userId: string) {
    await this.ensureSchemaSupport();

    const result = await this.databaseService.query<StravaConnectionRow>(
      `
        SELECT
          user_id,
          athlete_id,
          athlete_username,
          athlete_full_name,
          access_token,
          refresh_token,
          token_expires_at,
          status,
          last_backfill_started_at,
          last_backfill_finished_at,
          last_sync_started_at,
          last_sync_finished_at,
          last_synced_activity_at,
          last_error
        FROM strava_connections
        WHERE user_id = $1
      `,
      [userId],
    );

    const row = result.rows[0];

    return {
      connected: Boolean(row),
      connection: row ? this.mapConnection(row) : null,
    };
  }

  async createConnectUrl(userId: string) {
    await this.ensureSchemaSupport();

    const clientId = this.requiredEnv("STRAVA_CLIENT_ID");
    const redirectUri = this.requiredEnv("STRAVA_REDIRECT_URI");
    const state = await this.jwtService.signAsync(
      { sub: userId, type: "strava_connect" },
      {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "change-me",
        expiresIn: "15m" as never,
      },
    );

    const url = new URL("https://www.strava.com/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("scope", "read,activity:read_all");
    url.searchParams.set("state", state);

    return {
      connectUrl: url.toString(),
      state,
    };
  }

  async connect(userId: string, code: string, state: string) {
    await this.ensureSchemaSupport();
    await this.verifyState(userId, state);

    const tokenResponse = await this.exchangeCodeForToken(code);
    const athleteFullName = [tokenResponse.athlete.firstname, tokenResponse.athlete.lastname].filter(Boolean).join(" ") || null;

    await this.databaseService.query(
      `
        INSERT INTO strava_connections (
          user_id,
          athlete_id,
          athlete_username,
          athlete_full_name,
          access_token,
          refresh_token,
          token_expires_at,
          status,
          last_error,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), 'active', NULL, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          athlete_id = EXCLUDED.athlete_id,
          athlete_username = EXCLUDED.athlete_username,
          athlete_full_name = EXCLUDED.athlete_full_name,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expires_at = EXCLUDED.token_expires_at,
          status = 'active',
          last_error = NULL,
          updated_at = NOW()
      `,
      [
        userId,
        tokenResponse.athlete.id,
        tokenResponse.athlete.username ?? null,
        athleteFullName,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        tokenResponse.expires_at,
      ],
    );

    await this.queueService.enqueueStravaSyncJob(
      {
        connectionUserId: userId,
        mode: "initial_backfill",
      },
      {
        jobId: `strava-initial-${userId}`,
      },
    );

    if (this.hasWebhookEnv()) {
      void this.ensureWebhookSubscription().catch((error: unknown) => {
        this.logger.warn(
          `Strava webhook subscription ensure failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      });
    }

    return {
      connected: true,
      backgroundSyncStarted: true,
    };
  }

  async ensureWebhookSubscription() {
    const clientId = this.requiredEnv("STRAVA_CLIENT_ID");
    const clientSecret = this.requiredEnv("STRAVA_CLIENT_SECRET");
    const callbackUrl = this.requiredEnv("STRAVA_WEBHOOK_CALLBACK_URL");
    const verifyToken = this.requiredEnv("STRAVA_WEBHOOK_VERIFY_TOKEN");

    const current = await this.fetchWebhookSubscriptions(clientId, clientSecret);
    const existing = current.find((item) => item.callback_url === callbackUrl);

    if (existing) {
      return {
        subscribed: true,
        subscriptionId: existing.id,
        callbackUrl: existing.callback_url,
      };
    }

    const body = new URLSearchParams();
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    body.set("callback_url", callbackUrl);
    body.set("verify_token", verifyToken);

    const response = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new BadRequestException(`Strava webhook subscription failed with status ${response.status}`);
    }

    const created = (await response.json()) as {
      id: number;
      callback_url: string;
    };

    return {
      subscribed: true,
      subscriptionId: created.id,
      callbackUrl: created.callback_url,
    };
  }

  handleWebhookValidation(mode?: string, verifyToken?: string, challenge?: string) {
    if (mode !== "subscribe") {
      throw new BadRequestException("Unsupported hub.mode");
    }

    if (verifyToken !== this.requiredEnv("STRAVA_WEBHOOK_VERIFY_TOKEN")) {
      throw new UnauthorizedException("Invalid Strava webhook verify token");
    }

    if (!challenge) {
      throw new BadRequestException("Missing hub.challenge");
    }

    return {
      "hub.challenge": challenge,
    };
  }

  async handleWebhookEvent(body: {
    aspect_type?: "create" | "update" | "delete";
    event_time?: number;
    object_id?: number;
    object_type?: "activity" | "athlete";
    owner_id?: number;
    subscription_id?: number;
    updates?: Record<string, string>;
  }) {
    if (!body.owner_id || !body.object_type || !body.aspect_type) {
      return { received: true, ignored: true };
    }

    const connection = await this.databaseService.query<{ user_id: string }>(
      `
        SELECT user_id
        FROM strava_connections
        WHERE athlete_id = $1
      `,
      [body.owner_id],
    );

    const userId = connection.rows[0]?.user_id;

    if (!userId) {
      return { received: true, ignored: true };
    }

    if (body.object_type === "athlete" && body.aspect_type === "update" && body.updates?.authorized === "false") {
      await this.databaseService.query(
        `
          UPDATE strava_connections
          SET status = 'revoked', updated_at = NOW(), last_error = 'Authorization revoked from Strava'
          WHERE user_id = $1
        `,
        [userId],
      );

      return { received: true, action: "revoked" };
    }

    if (body.object_type === "activity" && body.aspect_type === "delete" && body.object_id) {
      await this.databaseService.query(
        `
          DELETE FROM activities
          WHERE user_id = $1
            AND source_type = 'strava'
            AND source_label = $2
        `,
        [userId, String(body.object_id)],
      );

      return { received: true, action: "deleted" };
    }

    if (body.object_type === "activity") {
      await this.queueService.enqueueStravaSyncJob(
        {
          connectionUserId: userId,
          mode: "incremental",
        },
        {
          jobId: `strava-webhook-${userId}-${body.object_id ?? "unknown"}-${body.event_time ?? Date.now()}`,
        },
      );

      return { received: true, action: "sync_enqueued" };
    }

    return { received: true, ignored: true };
  }

  async enqueueManualSync(userId: string) {
    await this.ensureSchemaSupport();
    const connection = await this.getRequiredConnection(userId);

    await this.queueService.enqueueStravaSyncJob({
      connectionUserId: connection.user_id,
      mode: "incremental",
    });

    return {
      enqueued: true,
    };
  }

  async disconnect(userId: string) {
    await this.ensureSchemaSupport();

    await this.databaseService.query(
      `
        DELETE FROM strava_connections
        WHERE user_id = $1
      `,
      [userId],
    );

    return {
      disconnected: true,
    };
  }

  async enqueueDueConnections() {
    await this.ensureSchemaSupport();

    const result = await this.databaseService.query<{ user_id: string }>(
      `
        SELECT user_id
        FROM strava_connections
        WHERE status = 'active'
          AND (
            last_sync_finished_at IS NULL
            OR last_sync_finished_at < NOW() - INTERVAL '15 minutes'
          )
        ORDER BY updated_at ASC
        LIMIT 20
      `,
    );

    for (const row of result.rows) {
      await this.queueService.enqueueStravaSyncJob(
        {
          connectionUserId: row.user_id,
          mode: "incremental",
        },
        {
          jobId: `strava-incremental-${row.user_id}`,
        },
      );
    }
  }

  async syncConnection(userId: string, mode: "initial_backfill" | "incremental") {
    await this.ensureSchemaSupport();
    const connection = await this.refreshConnectionIfNeeded(await this.getRequiredConnection(userId));

    await this.databaseService.query(
      `
        UPDATE strava_connections
        SET
          ${mode === "initial_backfill" ? "last_backfill_started_at = NOW()," : ""}
          last_sync_started_at = NOW(),
          last_error = NULL,
          updated_at = NOW()
        WHERE user_id = $1
      `,
      [userId],
    );

    try {
      const activities = await this.fetchActivities(connection, mode);
      let latestSyncedAt: string | null = null;

      for (const activity of activities) {
        await this.upsertActivityFromStrava(userId, activity, connection.access_token);
        if (!latestSyncedAt || new Date(activity.start_date) > new Date(latestSyncedAt)) {
          latestSyncedAt = activity.start_date;
        }
      }

      await this.databaseService.query(
        `
          UPDATE strava_connections
          SET
            status = 'active',
            ${mode === "initial_backfill" ? "last_backfill_finished_at = NOW()," : ""}
            last_sync_finished_at = NOW(),
            last_synced_activity_at = COALESCE($2::timestamptz, last_synced_activity_at),
            last_error = NULL,
            updated_at = NOW()
          WHERE user_id = $1
        `,
        [userId, latestSyncedAt],
      );
    } catch (error) {
      await this.databaseService.query(
        `
          UPDATE strava_connections
          SET
            status = 'error',
            last_error = $2,
            updated_at = NOW()
          WHERE user_id = $1
        `,
        [userId, error instanceof Error ? error.message : "Unknown Strava sync error"],
      );

      throw error;
    }
  }

  private async upsertActivityFromStrava(userId: string, activity: StravaActivity, accessToken: string) {
    const externalId = String(activity.id);
    const stream = await this.fetchActivityStreams(accessToken, activity.id);
    const points = (stream.latlng?.data ?? []).map(([lat, lon]) => ({ lat, lon }));

    await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        `
          SELECT id
          FROM activities
          WHERE user_id = $1 AND source_type = 'strava' AND source_label = $2
        `,
        [userId, externalId],
      );

      let activityId = existing.rows[0]?.id;

      if (!activityId) {
        const inserted = await client.query<{ id: string }>(
          `
            INSERT INTO activities (
              user_id,
              sport_type,
              title,
              started_at,
              duration_seconds,
              distance_meters,
              elevation_gain_meters,
              avg_heart_rate,
              calories,
              visibility,
              source_type,
              source_label,
              has_route
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'public', 'strava', $10, $11)
            RETURNING id
          `,
          [
            userId,
            this.mapStravaSportType(activity.type),
            activity.name,
            activity.start_date,
            activity.moving_time || activity.elapsed_time || 0,
            activity.distance,
            activity.total_elevation_gain,
            activity.average_heartrate ?? null,
            activity.calories ?? null,
            externalId,
            points.length > 1,
          ],
        );
        activityId = inserted.rows[0].id;
      } else {
        await client.query(
          `
            UPDATE activities
            SET
              sport_type = $2,
              title = $3,
              started_at = $4,
              duration_seconds = $5,
              distance_meters = $6,
              elevation_gain_meters = $7,
              avg_heart_rate = $8,
              calories = $9,
              has_route = $10,
              updated_at = NOW()
            WHERE id = $1
          `,
          [
            activityId,
            this.mapStravaSportType(activity.type),
            activity.name,
            activity.start_date,
            activity.moving_time || activity.elapsed_time || 0,
            activity.distance,
            activity.total_elevation_gain,
            activity.average_heartrate ?? null,
            activity.calories ?? null,
            points.length > 1,
          ],
        );
      }

      if (points.length > 1) {
        const bounds = this.computeBounds(points);
        const lineStringWkt = `LINESTRING(${points.map((point) => `${point.lon} ${point.lat}`).join(", ")})`;
        const startPoint = points[0];
        const endPoint = points[points.length - 1];

        await client.query(
          `
            INSERT INTO activity_routes (
              activity_id,
              geom,
              bounds,
              start_point,
              end_point
            )
            VALUES (
              $1,
              ST_GeogFromText($2),
              $3::jsonb,
              ST_GeogFromText($4),
              ST_GeogFromText($5)
            )
            ON CONFLICT (activity_id)
            DO UPDATE SET
              geom = EXCLUDED.geom,
              bounds = EXCLUDED.bounds,
              start_point = EXCLUDED.start_point,
              end_point = EXCLUDED.end_point
          `,
          [
            activityId,
            lineStringWkt,
            JSON.stringify(bounds),
            `POINT(${startPoint.lon} ${startPoint.lat})`,
            `POINT(${endPoint.lon} ${endPoint.lat})`,
          ],
        );
      }
    });
  }

  private async fetchActivities(
    connection: StravaConnectionRow,
    mode: "initial_backfill" | "incremental",
  ) {
    const items: StravaActivity[] = [];
    const maxPages = mode === "initial_backfill" ? 10 : 2;
    const perPage = mode === "initial_backfill" ? 50 : 30;
    const after = mode === "incremental" && connection.last_synced_activity_at
      ? Math.floor(new Date(connection.last_synced_activity_at).getTime() / 1000) - 1
      : undefined;

    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL("https://www.strava.com/api/v3/athlete/activities");
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(perPage));
      if (after) {
        url.searchParams.set("after", String(after));
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Strava activities request failed with status ${response.status}`);
      }

      const pageItems = (await response.json()) as StravaActivity[];

      if (!pageItems.length) {
        break;
      }

      items.push(...pageItems);

      if (pageItems.length < perPage) {
        break;
      }
    }

    return items;
  }

  private async fetchActivityStreams(accessToken: string, activityId: number) {
    const url = new URL(`https://www.strava.com/api/v3/activities/${activityId}/streams`);
    url.searchParams.set("keys", "latlng");
    url.searchParams.set("key_by_type", "true");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return {} as StravaStreamsResponse;
    }

    return (await response.json()) as StravaStreamsResponse;
  }

  private async exchangeCodeForToken(code: string) {
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.requiredEnv("STRAVA_CLIENT_ID"),
        client_secret: this.requiredEnv("STRAVA_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException("Strava token exchange failed");
    }

    return (await response.json()) as StravaTokenResponse;
  }

  private async refreshConnectionIfNeeded(connection: StravaConnectionRow) {
    if (new Date(connection.token_expires_at).getTime() > Date.now() + 60_000) {
      return connection;
    }

    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.requiredEnv("STRAVA_CLIENT_ID"),
        client_secret: this.requiredEnv("STRAVA_CLIENT_SECRET"),
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException("Strava refresh token exchange failed");
    }

    const refreshed = (await response.json()) as StravaTokenResponse;

    await this.databaseService.query(
      `
        UPDATE strava_connections
        SET
          access_token = $2,
          refresh_token = $3,
          token_expires_at = to_timestamp($4),
          status = 'active',
          last_error = NULL,
          updated_at = NOW()
        WHERE user_id = $1
      `,
      [connection.user_id, refreshed.access_token, refreshed.refresh_token, refreshed.expires_at],
    );

    return {
      ...connection,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      status: "active" as const,
    };
  }

  private async fetchWebhookSubscriptions(clientId: string, clientSecret: string) {
    const url = new URL("https://www.strava.com/api/v3/push_subscriptions");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new BadRequestException(`Strava webhook list failed with status ${response.status}`);
    }

    return (await response.json()) as Array<{
      id: number;
      callback_url: string;
    }>;
  }

  private async getRequiredConnection(userId: string) {
    const result = await this.databaseService.query<StravaConnectionRow>(
      `
        SELECT
          user_id,
          athlete_id,
          athlete_username,
          athlete_full_name,
          access_token,
          refresh_token,
          token_expires_at,
          status,
          last_backfill_started_at,
          last_backfill_finished_at,
          last_sync_started_at,
          last_sync_finished_at,
          last_synced_activity_at,
          last_error
        FROM strava_connections
        WHERE user_id = $1
      `,
      [userId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException("Strava connection not found");
    }

    return row;
  }

  private async verifyState(userId: string, state: string) {
    const payload = await this.jwtService.verifyAsync<{ sub: string; type: string }>(state, {
      secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "change-me",
    });

    if (payload.type !== "strava_connect" || payload.sub !== userId) {
      throw new UnauthorizedException("Invalid Strava state");
    }
  }

  private mapConnection(row: StravaConnectionRow) {
    return {
      athleteId: row.athlete_id,
      athleteUsername: row.athlete_username,
      athleteFullName: row.athlete_full_name,
      status: row.status,
      tokenExpiresAt: new Date(row.token_expires_at).toISOString(),
      lastBackfillStartedAt: row.last_backfill_started_at ? new Date(row.last_backfill_started_at).toISOString() : null,
      lastBackfillFinishedAt: row.last_backfill_finished_at ? new Date(row.last_backfill_finished_at).toISOString() : null,
      lastSyncStartedAt: row.last_sync_started_at ? new Date(row.last_sync_started_at).toISOString() : null,
      lastSyncFinishedAt: row.last_sync_finished_at ? new Date(row.last_sync_finished_at).toISOString() : null,
      lastSyncedActivityAt: row.last_synced_activity_at ? new Date(row.last_synced_activity_at).toISOString() : null,
      lastError: row.last_error,
    };
  }

  private mapStravaSportType(type: string) {
    const value = type.toLowerCase();

    if (value.includes("ride")) return "cycling";
    if (value.includes("run")) return "running";
    if (value.includes("swim")) return "swimming";
    if (value.includes("walk") || value.includes("hike")) return "walking";
    if (value.includes("ski")) return "skiing";

    return "other";
  }

  private computeBounds(points: Array<{ lat: number; lon: number }>) {
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };
  }

  private requiredEnv(name: string) {
    const value = this.configService.get<string>(name);
    if (!value) {
      throw new BadRequestException(`${name} is not configured`);
    }
    return value;
  }

  private hasWebhookEnv() {
    return Boolean(
      this.configService.get<string>("STRAVA_WEBHOOK_CALLBACK_URL") &&
        this.configService.get<string>("STRAVA_WEBHOOK_VERIFY_TOKEN"),
    );
  }

  private async ensureSchemaSupport() {
    await this.databaseService.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_connection_status') THEN
          CREATE TYPE external_connection_status AS ENUM ('active', 'revoked', 'error');
        END IF;
      END$$;
    `);

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS strava_connections (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        athlete_id BIGINT NOT NULL UNIQUE,
        athlete_username VARCHAR(120),
        athlete_full_name VARCHAR(160),
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expires_at TIMESTAMPTZ NOT NULL,
        status external_connection_status NOT NULL DEFAULT 'active',
        last_backfill_started_at TIMESTAMPTZ,
        last_backfill_finished_at TIMESTAMPTZ,
        last_sync_started_at TIMESTAMPTZ,
        last_sync_finished_at TIMESTAMPTZ,
        last_synced_activity_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_strava_connections_status_updated_at
      ON strava_connections (status, updated_at DESC)
    `);
  }
}
