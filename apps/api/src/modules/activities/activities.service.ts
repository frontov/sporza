import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { DatabaseService } from "../../infrastructure/database/database.service";

interface ActivityRow {
  id: string;
  user_id: string;
  sport_type: string;
  title: string | null;
  description?: string | null;
  started_at: Date | string;
  duration_seconds: number;
  distance_meters: string | number | null;
  elevation_gain_meters: string | number | null;
  avg_speed_mps?: string | number | null;
  avg_pace_seconds_per_km?: number | null;
  avg_heart_rate: number | null;
  calories: number | null;
  visibility: "public" | "followers" | "private";
  source_type?: string;
  source_label?: string | null;
  has_route?: boolean;
  likes_count: number;
  comments_count: number;
  liked_by_me?: boolean | null;
}

@Injectable()
export class ActivitiesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(userId: string, cursor?: string) {
    const limit = 20;
    const params: unknown[] = [userId];
    let cursorFilter = "";

    if (cursor) {
      params.push(cursor);
      cursorFilter = `AND a.started_at < $2::timestamptz`;
    }

    const result = await this.databaseService.query<ActivityRow>(
      `
        SELECT
          a.id,
          a.user_id,
          a.sport_type,
          a.title,
          a.started_at,
          a.duration_seconds,
          a.distance_meters,
          a.elevation_gain_meters,
          a.avg_heart_rate,
          a.calories,
          a.visibility,
          a.likes_count,
          a.comments_count
        FROM activities a
        WHERE a.user_id = $1
          ${cursorFilter}
        ORDER BY a.started_at DESC
        LIMIT ${limit + 1}
      `,
      params,
    );

    const items = result.rows.slice(0, limit).map((row: ActivityRow) => this.mapActivity(row));
    const nextCursor = result.rows.length > limit ? new Date(result.rows[limit - 1].started_at).toISOString() : null;

    return { items, nextCursor };
  }

  async getOne(activityId: string, userId?: string) {
    const result = await this.databaseService.query<ActivityRow>(
      `
        SELECT
          id,
          user_id,
          sport_type,
          title,
          description,
          started_at,
          duration_seconds,
          distance_meters,
          elevation_gain_meters,
          avg_speed_mps,
          avg_pace_seconds_per_km,
          avg_heart_rate,
          calories,
          visibility,
          source_type,
          source_label,
          has_route,
          likes_count,
          comments_count,
          ${
            userId
              ? "EXISTS (SELECT 1 FROM likes l WHERE l.activity_id = activities.id AND l.user_id = $2) AS liked_by_me"
              : "FALSE AS liked_by_me"
          }
        FROM activities
        WHERE id = $1
      `,
      userId ? [activityId, userId] : [activityId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException("Activity not found");
    }

    if (row.visibility === "private" && row.user_id !== userId) {
      throw new ForbiddenException("Activity is private");
    }

    const routeResult = await this.databaseService.query<{
      bounds: {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
      } | null;
      points: Array<{ lat: number; lon: number }> | null;
    }>(
      `
        SELECT
          bounds,
          (
            SELECT json_agg(
              json_build_object(
                'lat', ST_Y((dumped.geom)::geometry),
                'lon', ST_X((dumped.geom)::geometry)
              )
              ORDER BY dumped.path
            )
            FROM ST_DumpPoints((ar.geom)::geometry) AS dumped
          ) AS points
        FROM activity_routes ar
        WHERE ar.activity_id = $1
      `,
      [activityId],
    );

    return {
      ...this.mapActivity(row),
      description: row.description ?? null,
      avgSpeedMps: row.avg_speed_mps === null || row.avg_speed_mps === undefined ? null : Number(row.avg_speed_mps),
      avgPaceSecondsPerKm: row.avg_pace_seconds_per_km ?? null,
      sourceType: row.source_type ?? null,
      sourceLabel: row.source_label ?? null,
      hasRoute: row.has_route ?? false,
      likedByMe: Boolean(row.liked_by_me),
      route: routeResult.rows[0]
        ? {
            bounds: routeResult.rows[0].bounds,
            points: routeResult.rows[0].points ?? [],
          }
        : null,
    };
  }

  async remove(userId: string, activityId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      `DELETE FROM activities WHERE id = $1 AND user_id = $2 RETURNING id`,
      [activityId, userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException("Activity not found");
    }

    return { deleted: true };
  }

  async updatePrivacy(userId: string, activityId: string, visibility: string) {
    const result = await this.databaseService.query<{ id: string; visibility: string }>(
      `
        UPDATE activities
        SET visibility = $3, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id, visibility
      `,
      [activityId, userId, visibility],
    );

    if (!result.rows[0]) {
      throw new NotFoundException("Activity not found");
    }

    return result.rows[0];
  }

  async like(userId: string, activityId: string) {
    await this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query(
        `
          INSERT INTO likes (user_id, activity_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          RETURNING activity_id
        `,
        [userId, activityId],
      );

      if (inserted.rowCount) {
        await client.query(
          `UPDATE activities SET likes_count = likes_count + 1, updated_at = NOW() WHERE id = $1`,
          [activityId],
        );
      }
    });

    return { activityId, liked: true };
  }

  async unlike(userId: string, activityId: string) {
    await this.databaseService.withTransaction(async (client) => {
      const deleted = await client.query(
        `DELETE FROM likes WHERE user_id = $1 AND activity_id = $2 RETURNING activity_id`,
        [userId, activityId],
      );

      if (deleted.rowCount) {
        await client.query(
          `UPDATE activities SET likes_count = GREATEST(likes_count - 1, 0), updated_at = NOW() WHERE id = $1`,
          [activityId],
        );
      }
    });

    return { activityId, liked: false };
  }

  async listComments(activityId: string) {
    const result = await this.databaseService.query<{
      id: string;
      user_id: string;
      body: string;
      created_at: Date | string;
    }>(
      `
        SELECT id, user_id, body, created_at
        FROM comments
        WHERE activity_id = $1 AND is_hidden = FALSE
        ORDER BY created_at DESC
      `,
      [activityId],
    );

    return {
      items: result.rows.map((row: { id: string; user_id: string; body: string; created_at: Date | string }) => ({
        id: row.id,
        userId: row.user_id,
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    };
  }

  async createComment(userId: string, activityId: string, body: string) {
    return this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query<{
        id: string;
        activity_id: string;
        user_id: string;
        body: string;
        created_at: Date | string;
      }>(
        `
          INSERT INTO comments (activity_id, user_id, body)
          VALUES ($1, $2, $3)
          RETURNING id, activity_id, user_id, body, created_at
        `,
        [activityId, userId, body],
      );

      await client.query(
        `UPDATE activities SET comments_count = comments_count + 1, updated_at = NOW() WHERE id = $1`,
        [activityId],
      );

      const row = inserted.rows[0];

      return {
        id: row.id,
        activityId: row.activity_id,
        userId: row.user_id,
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
      };
    });
  }

  private mapActivity(row: ActivityRow) {
    return {
      id: row.id,
      userId: row.user_id,
      sportType: row.sport_type,
      title: row.title,
      startedAt: new Date(row.started_at).toISOString(),
      durationSeconds: row.duration_seconds,
      distanceMeters: row.distance_meters === null ? null : Number(row.distance_meters),
      elevationGainMeters: row.elevation_gain_meters === null ? null : Number(row.elevation_gain_meters),
      avgHeartRate: row.avg_heart_rate,
      calories: row.calories,
      visibility: row.visibility,
      likesCount: row.likes_count,
      commentsCount: row.comments_count,
    };
  }
}
