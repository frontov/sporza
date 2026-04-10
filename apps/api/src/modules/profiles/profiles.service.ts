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
  region: string | null;
  city: string | null;
  bio: string | null;
  sports: string[] | null;
  is_followed_by_me?: boolean | null;
}

interface ProfileEventRow {
  id: string;
  title: string;
  description: string | null;
  sport_type: string;
  region: string | null;
  city: string | null;
  venue: string | null;
  starts_at: Date | string;
  registration_url: string | null;
  source_url: string;
  image_url: string | null;
  source_name: string;
  source_event_id: string;
  participation_status: "interested" | "going" | null;
  is_favorite: boolean;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  async getCurrentProfile(userId: string) {
    await this.ensureLocationCatalogSupport();
    return this.getProfileByUserId(userId);
  }

  async updateCurrentProfile(userId: string, dto: UpdateProfileDto) {
    await this.ensureLocationCatalogSupport();
    const current = await this.getProfileByUserId(userId);

    const fullName = dto.fullName ?? current.fullName;
    const region = dto.region ?? current.region;
    const city = dto.city ?? current.city;
    const bio = dto.bio ?? current.bio;
    const sports = dto.sports ?? current.sports;
    const regionId = region ? await this.resolveRegionId(region) : null;

    const result = await this.databaseService.query<ProfileRow>(
      `
        UPDATE profiles
        SET full_name = $2,
            region = $3,
            region_id = $4,
            city = $5,
            bio = $6,
            sports = $7::jsonb,
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING user_id, username, full_name, avatar_url, region, city, bio, sports
      `,
      [userId, fullName, region, regionId, city, bio, JSON.stringify(sports)],
    );

    return this.mapProfile(result.rows[0]);
  }

  async uploadAvatar(userId: string, file: { buffer: Buffer; mimetype?: string; originalname: string }) {
    await this.ensureLocationCatalogSupport();
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
        RETURNING user_id, username, full_name, avatar_url, region, city, bio, sports
      `,
      [userId, avatarUrl],
    );

    return this.mapProfile(result.rows[0]);
  }

  async getPublicProfile(username: string, currentUserId?: string) {
    await this.ensureLocationCatalogSupport();
    const result = await this.databaseService.query<ProfileRow>(
      `
        SELECT
          user_id,
          username,
          full_name,
          avatar_url,
          region,
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

    const eventsResult = await this.databaseService.query<ProfileEventRow>(
      `
        SELECT
          e.id,
          e.title,
          e.description,
          e.sport_type,
          e.region,
          e.city,
          e.venue,
          e.starts_at,
          e.registration_url,
          e.source_url,
          e.image_url,
          e.source_name,
          e.source_event_id,
          ep.status AS participation_status,
          COALESCE(ef.event_id IS NOT NULL, FALSE) AS is_favorite
        FROM events e
        LEFT JOIN event_participations ep ON ep.event_id = e.id AND ep.user_id = $1
        LEFT JOIN event_favorites ef ON ef.event_id = e.id AND ef.user_id = $1
        WHERE (ep.user_id IS NOT NULL OR ef.user_id IS NOT NULL)
          AND e.is_hidden = FALSE
          AND e.is_archived = FALSE
        ORDER BY e.starts_at ASC
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
      events: eventsResult.rows.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        sportType: event.sport_type,
        region: event.region,
        city: event.city,
        venue: event.venue,
        startsAt: new Date(event.starts_at).toISOString(),
        registrationUrl: event.registration_url,
        sourceUrl: event.source_url,
        imageUrl: event.image_url,
        sourceName: event.source_name,
        sourceEventId: event.source_event_id,
        participationStatus: event.participation_status,
        isFavorite: event.is_favorite,
        favoriteFriends: [],
        favoriteFriendsCount: 0,
      })),
    };
  }

  async searchProfiles(query: string) {
    await this.ensureLocationCatalogSupport();
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return { items: [] };
    }

    const like = `%${normalizedQuery}%`;
    const result = await this.databaseService.query<ProfileRow>(
      `
        SELECT user_id, username, full_name, avatar_url, region, city, bio, sports
        FROM profiles
        WHERE username ILIKE $1 OR full_name ILIKE $1 OR city ILIKE $1 OR region ILIKE $1
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

  async listRegions() {
    await this.ensureLocationCatalogSupport();

    const result = await this.databaseService.query<{ name: string }>(
      `
        SELECT name
        FROM regions
        ORDER BY name ASC
      `,
    );

    return {
      items: result.rows.map((row) => row.name),
    };
  }

  private async getProfileByUserId(userId: string) {
    const result = await this.databaseService.query<ProfileRow>(
      `
        SELECT user_id, username, full_name, avatar_url, region, city, bio, sports
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
      region: row.region,
      city: row.city,
      bio: row.bio,
      sports: row.sports ?? [],
    };
  }

  private async ensureLocationCatalogSupport() {
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL UNIQUE,
        slug VARCHAR(160) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS cities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        slug VARCHAR(160) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (region_id, name)
      )
    `);

    await this.databaseService.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region VARCHAR(120)`);
    await this.databaseService.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL`);
    await this.databaseService.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL`);
    await this.databaseService.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL`);
    await this.databaseService.query(`CREATE INDEX IF NOT EXISTS idx_profiles_region_id ON profiles (region_id)`);
    await this.databaseService.query(`CREATE INDEX IF NOT EXISTS idx_events_region_id ON events (region_id)`);
    await this.databaseService.query(`CREATE INDEX IF NOT EXISTS idx_events_city_id ON events (city_id)`);

    await this.databaseService.query(`
      INSERT INTO regions (name, slug)
      SELECT DISTINCT source.region_name, source.region_slug
      FROM (
        SELECT region AS region_name, LOWER(REGEXP_REPLACE(region, '[^[:alnum:]а-яА-Я]+', '-', 'g')) AS region_slug
        FROM events
        WHERE region IS NOT NULL AND region <> ''
        UNION
        SELECT region AS region_name, LOWER(REGEXP_REPLACE(region, '[^[:alnum:]а-яА-Я]+', '-', 'g')) AS region_slug
        FROM profiles
        WHERE region IS NOT NULL AND region <> ''
      ) source
      ON CONFLICT (name) DO NOTHING
    `);

    await this.databaseService.query(`
      UPDATE profiles p
      SET region_id = r.id
      FROM regions r
      WHERE p.region IS NOT NULL
        AND p.region <> ''
        AND p.region_id IS NULL
        AND r.name = p.region
    `);

    await this.databaseService.query(`
      UPDATE events e
      SET region_id = r.id
      FROM regions r
      WHERE e.region IS NOT NULL
        AND e.region <> ''
        AND e.region_id IS NULL
        AND r.name = e.region
    `);

    await this.databaseService.query(`
      INSERT INTO cities (region_id, name, slug)
      SELECT DISTINCT r.id, e.city, LOWER(REGEXP_REPLACE(e.city, '[^[:alnum:]а-яА-Я]+', '-', 'g'))
      FROM events e
      JOIN regions r ON r.name = e.region
      WHERE e.city IS NOT NULL
        AND e.city <> ''
      ON CONFLICT (region_id, name) DO NOTHING
    `);

    await this.databaseService.query(`
      UPDATE events e
      SET city_id = c.id
      FROM regions r
      JOIN cities c ON c.region_id = r.id AND c.name = e.city
      WHERE e.city IS NOT NULL
        AND e.city <> ''
        AND e.city_id IS NULL
        AND r.name = e.region
    `);
  }

  private async resolveRegionId(regionName: string) {
    const normalized = regionName.trim();

    if (!normalized) {
      return null;
    }

    const slug = normalized.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    const result = await this.databaseService.query<{ id: string }>(
      `
        INSERT INTO regions (name, slug)
        VALUES ($1, $2)
        ON CONFLICT (name)
        DO UPDATE SET slug = EXCLUDED.slug
        RETURNING id
      `,
      [normalized, slug || "region"],
    );

    return result.rows[0]?.id ?? null;
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
