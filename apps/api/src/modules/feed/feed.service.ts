import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../../infrastructure/database/database.service";

interface ActivityRow {
  id: string;
  user_id: string;
  sport_type: string;
  title: string | null;
  started_at: Date | string;
  duration_seconds: number;
  distance_meters: string | number | null;
  elevation_gain_meters: string | number | null;
  avg_heart_rate: number | null;
  calories: number | null;
  visibility: "public" | "followers" | "private";
  likes_count: number;
  comments_count: number;
  author_username: string | null;
}

@Injectable()
export class FeedService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getFeed(viewerId: string, cursor?: string) {
    const limit = 20;
    const params: unknown[] = [viewerId];
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
          a.comments_count,
          p.username AS author_username
        FROM activities a
        LEFT JOIN profiles p ON p.user_id = a.user_id
        WHERE (
          a.user_id = $1
          OR (
            EXISTS (
              SELECT 1
              FROM follows f
              WHERE f.follower_id = $1
                AND f.followee_id = a.user_id
            )
            AND a.visibility IN ('public', 'followers')
          )
        )
        ${cursorFilter}
        ORDER BY a.started_at DESC
        LIMIT ${limit + 1}
      `,
      params,
    );

    const items = result.rows.slice(0, limit).map((row) => this.mapActivity(row));
    const nextCursor =
      result.rows.length > limit ? new Date(result.rows[limit - 1].started_at).toISOString() : null;

    return { items, nextCursor };
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
      ...(row.author_username ? { authorUsername: row.author_username } : {}),
    };
  }
}
