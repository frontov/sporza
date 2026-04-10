import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { DatabaseService } from "../../infrastructure/database/database.service";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

interface ProfileRow {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  sports: string[] | null;
  is_followed_by_me?: boolean | null;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  async getCurrentProfile(userId: string) {
    return this.getProfileByUserId(userId);
  }

  async updateCurrentProfile(userId: string, dto: UpdateProfileDto) {
    const current = await this.getProfileByUserId(userId);

    const fullName = dto.fullName ?? current.fullName;
    const city = dto.city ?? current.city;
    const bio = dto.bio ?? current.bio;
    const sports = dto.sports ?? current.sports;

    const result = await this.databaseService.query<ProfileRow>(
      `
        UPDATE profiles
        SET full_name = $2,
            city = $3,
            bio = $4,
            sports = $5::jsonb,
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING user_id, username, full_name, avatar_url, city, bio, sports
      `,
      [userId, fullName, city, bio, JSON.stringify(sports)],
    );

    return this.mapProfile(result.rows[0]);
  }

  async uploadAvatar(userId: string, file: { buffer: Buffer; mimetype?: string; originalname: string }) {
    await this.getProfileByUserId(userId);

    const extension = this.resolveAvatarExtension(file.originalname, file.mimetype);
    const key = `profiles/${userId}/avatar-${randomUUID()}.${extension}`;

    await this.storageService.putObject(key, file.buffer, file.mimetype);

    const avatarUrl = this.storageService.getPublicObjectUrl(key);

    const result = await this.databaseService.query<ProfileRow>(
      `
        UPDATE profiles
        SET avatar_url = $2,
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING user_id, username, full_name, avatar_url, city, bio, sports
      `,
      [userId, avatarUrl],
    );

    return this.mapProfile(result.rows[0]);
  }

  async getPublicProfile(username: string, currentUserId?: string) {
    const result = await this.databaseService.query<ProfileRow>(
      `
        SELECT
          user_id,
          username,
          full_name,
          avatar_url,
          city,
          bio,
          sports,
          ${
            currentUserId
              ? "EXISTS (SELECT 1 FROM follows f WHERE f.followee_id = profiles.user_id AND f.follower_id = $2) AS is_followed_by_me"
              : "FALSE AS is_followed_by_me"
          }
        FROM profiles
        WHERE username = $1
      `,
      currentUserId ? [username, currentUserId] : [username],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException("Profile not found");
    }

    const activitiesResult = await this.databaseService.query<{
      id: string;
      sport_type: string;
      title: string | null;
      started_at: Date | string;
      duration_seconds: number;
      distance_meters: string | number | null;
      likes_count: number;
      comments_count: number;
      visibility: "public";
    }>(
      `
        SELECT
          id,
          sport_type,
          title,
          started_at,
          duration_seconds,
          distance_meters,
          likes_count,
          comments_count,
          visibility
        FROM activities
        WHERE user_id = $1 AND visibility = 'public'
        ORDER BY started_at DESC
        LIMIT 20
      `,
      [row.user_id],
    );

    return {
      ...this.mapProfile(row),
      isFollowedByMe: Boolean(row.is_followed_by_me),
      activities: activitiesResult.rows.map((activity) => ({
        id: activity.id,
        sportType: activity.sport_type,
        title: activity.title,
        startedAt: new Date(activity.started_at).toISOString(),
        durationSeconds: activity.duration_seconds,
        distanceMeters: activity.distance_meters === null ? null : Number(activity.distance_meters),
        likesCount: activity.likes_count,
        commentsCount: activity.comments_count,
        visibility: activity.visibility,
      })),
    };
  }

  async searchProfiles(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return { items: [] };
    }

    const like = `%${normalizedQuery}%`;
    const result = await this.databaseService.query<ProfileRow>(
      `
        SELECT user_id, username, full_name, avatar_url, city, bio, sports
        FROM profiles
        WHERE username ILIKE $1 OR full_name ILIKE $1 OR city ILIKE $1
        ORDER BY
          CASE WHEN username ILIKE $2 THEN 0 ELSE 1 END,
          full_name ASC
        LIMIT 20
      `,
      [like, `${normalizedQuery}%`],
    );

    return {
      items: result.rows.map((row) => this.mapProfile(row)),
    };
  }

  private async getProfileByUserId(userId: string) {
    const result = await this.databaseService.query<ProfileRow>(
      `
        SELECT user_id, username, full_name, avatar_url, city, bio, sports
        FROM profiles
        WHERE user_id = $1
      `,
      [userId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException("Profile not found");
    }

    return this.mapProfile(row);
  }

  private mapProfile(row: ProfileRow) {
    return {
      id: row.user_id,
      username: row.username,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      city: row.city,
      bio: row.bio,
      sports: row.sports ?? [],
    };
  }

  private resolveAvatarExtension(originalName: string, mimetype?: string) {
    const fromName = originalName.split(".").pop()?.toLowerCase();

    if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
      return fromName === "jpeg" ? "jpg" : fromName;
    }

    if (mimetype === "image/png") return "png";
    if (mimetype === "image/webp") return "webp";

    return "jpg";
  }
}
