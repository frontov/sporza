import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { DatabaseService } from "../../infrastructure/database/database.service";

interface EventFilters {
  sport?: string;
  region?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

interface EventRow {
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
  participation_status?: "interested" | "going" | null;
  is_favorite?: boolean | null;
}

interface EventSyncRunRow {
  id: string;
  status: string;
  inserted_count: number;
  updated_count: number;
  created_at: Date | string;
  finished_at: Date | string | null;
}

interface SporlyEvent {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  region: string | null;
  venue: string | null;
  category: string | null;
  starts_at: string;
  source_name: string;
  source_url: string;
  image_url: string | null;
  source_label?: string | null;
  source_type?: string | null;
  organizer_name?: string | null;
  date_text?: string | null;
}

interface SporlyResponse {
  items: SporlyEvent[];
  total_pages: number;
}

interface NormalizedExternalEvent {
  sourceName: string;
  sourceEventId: string;
  title: string;
  description: string | null;
  sportType: string;
  region: string | null;
  city: string | null;
  venue: string | null;
  startsAt: string;
  registrationUrl: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  metadata: Record<string, unknown>;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async list(filters: EventFilters, userId?: string) {
    await this.ensureFreshEventsCache();
    await this.ensureFavoritesSupport();

    const filterParams: unknown[] = [];
    const where = ["is_hidden = FALSE", "is_archived = FALSE"];
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 24));
    const offset = (page - 1) * pageSize;

    if (filters.sport) {
      filterParams.push(filters.sport);
      where.push(`sport_type = $${filterParams.length}`);
    }

    if (filters.region) {
      filterParams.push(filters.region);
      where.push(`region = $${filterParams.length}`);
    }

    if (filters.dateFrom) {
      filterParams.push(filters.dateFrom);
      where.push(`starts_at >= $${filterParams.length}::date`);
    }

    if (filters.dateTo) {
      filterParams.push(filters.dateTo);
      where.push(`starts_at < ($${filterParams.length}::date + INTERVAL '1 day')`);
    }

    const countResult = await this.databaseService.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM events
        WHERE ${where.join(" AND ")}
      `,
      filterParams,
    );

    const dataParams = [...filterParams];
    const participationSelect = userId
      ? `ep.status AS participation_status`
      : `NULL::event_participation_status AS participation_status`;
    const favoriteSelect = userId ? `COALESCE(ef.event_id IS NOT NULL, FALSE) AS is_favorite` : `FALSE AS is_favorite`;

    if (userId) {
      dataParams.push(userId);
    }

    const userParam = userId ? dataParams.length : null;

    dataParams.push(pageSize);
    const limitParam = dataParams.length;
    dataParams.push(offset);
    const offsetParam = dataParams.length;

    const result = await this.databaseService.query<EventRow>(
      `
        SELECT
          id,
          title,
          description,
          sport_type,
          region,
          city,
          venue,
          starts_at,
          registration_url,
          source_url,
          image_url,
          source_name,
          source_event_id,
          ${participationSelect},
          ${favoriteSelect}
        FROM events
        ${userId ? `LEFT JOIN event_participations ep ON ep.event_id = events.id AND ep.user_id = $${userParam}` : ""}
        ${userId ? `LEFT JOIN event_favorites ef ON ef.event_id = events.id AND ef.user_id = $${userParam}` : ""}
        WHERE ${where.join(" AND ")}
        ORDER BY starts_at ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      dataParams,
    );

    const total = Number(countResult.rows[0]?.total ?? "0");

    return {
      filters: {
        sport: filters.sport,
        region: filters.region,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: result.rows.map((row: EventRow) => this.mapEvent(row)),
    };
  }

  async getOne(eventId: string, userId?: string) {
    await this.ensureFreshEventsCache();
    await this.ensureFavoritesSupport();

    const result = await this.databaseService.query<EventRow>(
      `
        SELECT
          id,
          title,
          description,
          sport_type,
          region,
          city,
          venue,
          starts_at,
          registration_url,
          source_url,
          image_url,
          source_name,
          source_event_id,
          ${userId ? "ep.status AS participation_status" : "NULL::event_participation_status AS participation_status"},
          ${userId ? "COALESCE(ef.event_id IS NOT NULL, FALSE) AS is_favorite" : "FALSE AS is_favorite"}
        FROM events
        ${userId ? "LEFT JOIN event_participations ep ON ep.event_id = events.id AND ep.user_id = $2" : ""}
        ${userId ? "LEFT JOIN event_favorites ef ON ef.event_id = events.id AND ef.user_id = $2" : ""}
        WHERE id = $1 AND is_hidden = FALSE
      `,
      userId ? [eventId, userId] : [eventId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException("Event not found");
    }

    return this.mapEvent(row);
  }

  async setParticipation(userId: string, eventId: string, status: string) {
    await this.ensureEventExists(eventId);

    const result = await this.databaseService.query<{
      user_id: string;
      event_id: string;
      status: string;
      updated_at: Date | string;
    }>(
      `
        INSERT INTO event_participations (user_id, event_id, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, event_id)
        DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
        RETURNING user_id, event_id, status, updated_at
      `,
      [userId, eventId, status],
    );

    const row = result.rows[0];

    return {
      userId: row.user_id,
      eventId: row.event_id,
      status: row.status,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async removeParticipation(userId: string, eventId: string) {
    await this.databaseService.query(`DELETE FROM event_participations WHERE user_id = $1 AND event_id = $2`, [
      userId,
      eventId,
    ]);

    return {
      userId,
      eventId,
      status: null,
    };
  }

  async listFavorites(userId: string) {
    await this.ensureFreshEventsCache();
    await this.ensureFavoritesSupport();

    const result = await this.databaseService.query<EventRow>(
      `
        SELECT
          events.id,
          title,
          description,
          sport_type,
          region,
          city,
          venue,
          starts_at,
          registration_url,
          source_url,
          image_url,
          source_name,
          source_event_id,
          ep.status AS participation_status,
          TRUE AS is_favorite
        FROM event_favorites
        JOIN events ON events.id = event_favorites.event_id
        LEFT JOIN event_participations ep ON ep.event_id = events.id AND ep.user_id = $1
        WHERE event_favorites.user_id = $1 AND is_hidden = FALSE AND is_archived = FALSE
        ORDER BY event_favorites.created_at DESC, starts_at ASC
      `,
      [userId],
    );

    return {
      items: result.rows.map((row) => this.mapEvent(row)),
    };
  }

  async addFavorite(userId: string, eventId: string) {
    await this.ensureFavoritesSupport();
    await this.ensureEventExists(eventId);

    await this.databaseService.query(
      `
        INSERT INTO event_favorites (user_id, event_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [userId, eventId],
    );

    return {
      userId,
      eventId,
      isFavorite: true,
    };
  }

  async removeFavorite(userId: string, eventId: string) {
    await this.ensureFavoritesSupport();
    await this.databaseService.query(`DELETE FROM event_favorites WHERE user_id = $1 AND event_id = $2`, [userId, eventId]);

    return {
      userId,
      eventId,
      isFavorite: false,
    };
  }

  async syncExternalEvents() {
    const sourceName = "sporly";
    const syncRunResult = await this.databaseService.query<EventSyncRunRow>(
      `
        INSERT INTO event_sync_runs (status, source_name)
        VALUES ('running', $1)
        RETURNING id, status, inserted_count, updated_count, created_at, finished_at
      `,
      [sourceName],
    );
    const run = syncRunResult.rows[0];

    try {
      const externalEvents = await this.fetchSporlyEvents();

      const syncSummary = await this.databaseService.withTransaction(async (client) => {
        let insertedCount = 0;
        let updatedCount = 0;

        for (const event of externalEvents) {
          const upsertResult = await client.query<{ inserted: boolean }>(
            `
              INSERT INTO events (
                source_name,
                source_event_id,
                title,
                description,
                sport_type,
                region,
                city,
                venue,
                starts_at,
                registration_url,
                source_url,
                image_url,
                metadata,
                is_hidden,
                is_archived
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, FALSE, FALSE)
              ON CONFLICT (source_name, source_event_id)
              DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                sport_type = EXCLUDED.sport_type,
                region = EXCLUDED.region,
                city = EXCLUDED.city,
                venue = EXCLUDED.venue,
                starts_at = EXCLUDED.starts_at,
                registration_url = EXCLUDED.registration_url,
                source_url = EXCLUDED.source_url,
                image_url = EXCLUDED.image_url,
                metadata = EXCLUDED.metadata,
                is_archived = FALSE,
                updated_at = NOW()
              RETURNING (xmax = 0) AS inserted
            `,
            [
              event.sourceName,
              event.sourceEventId,
              event.title,
              event.description,
              event.sportType,
              event.region,
              event.city,
              event.venue,
              event.startsAt,
              event.registrationUrl,
              event.sourceUrl,
              event.imageUrl,
              JSON.stringify(event.metadata),
            ],
          );

          if (upsertResult.rows[0]?.inserted) {
            insertedCount += 1;
          } else {
            updatedCount += 1;
          }
        }

        await client.query(
          `
            UPDATE events
            SET is_archived = TRUE,
                updated_at = NOW()
            WHERE source_name = $1
              AND source_event_id <> ALL($2::text[])
          `,
          [sourceName, externalEvents.map((event) => event.sourceEventId)],
        );

        await client.query(
          `
            UPDATE events
            SET is_archived = TRUE,
                updated_at = NOW()
            WHERE source_name = 'seed_calendar'
          `,
        );

        return {
          insertedCount,
          updatedCount,
        };
      });

      const finishedResult = await this.databaseService.query<EventSyncRunRow>(
        `
          UPDATE event_sync_runs
          SET status = 'completed',
              inserted_count = $2,
              updated_count = $3,
              finished_at = NOW(),
              error_message = NULL
          WHERE id = $1
          RETURNING id, status, inserted_count, updated_count, created_at, finished_at
        `,
        [run.id, syncSummary.insertedCount, syncSummary.updatedCount],
      );

      const finishedRun = finishedResult.rows[0];

      return {
        jobId: finishedRun.id,
        status: finishedRun.status,
        insertedCount: finishedRun.inserted_count,
        updatedCount: finishedRun.updated_count,
        createdAt: new Date(finishedRun.created_at).toISOString(),
        finishedAt: finishedRun.finished_at ? new Date(finishedRun.finished_at).toISOString() : null,
      };
    } catch (error) {
      await this.databaseService.query(
        `
          UPDATE event_sync_runs
          SET status = 'failed',
              error_message = $2,
              finished_at = NOW()
          WHERE id = $1
        `,
        [run.id, error instanceof Error ? error.message : "Unknown sync error"],
      );

      throw error;
    }
  }

  private async ensureFreshEventsCache() {
    const sourceName = "sporly";
    const ttlMinutes = Number(this.configService.get<string>("SPORLY_SYNC_TTL_MINUTES") ?? "30");

    const [eventsResult, latestSyncResult] = await Promise.all([
      this.databaseService.query<{ count: string; sporly_count: string }>(
        `
          SELECT
            COUNT(*)::text AS count,
            COUNT(*) FILTER (WHERE source_name = $1 AND is_archived = FALSE)::text AS sporly_count
          FROM events
          WHERE is_hidden = FALSE AND is_archived = FALSE
        `,
        [sourceName],
      ),
      this.databaseService.query<{ finished_at: Date | string | null }>(
        `
          SELECT finished_at
          FROM event_sync_runs
          WHERE source_name = $1 AND status = 'completed'
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [sourceName],
      ),
    ]);

    const count = Number(eventsResult.rows[0]?.count ?? "0");
    const sporlyCount = Number(eventsResult.rows[0]?.sporly_count ?? "0");
    const lastFinishedAt = latestSyncResult.rows[0]?.finished_at
      ? new Date(latestSyncResult.rows[0].finished_at)
      : null;
    const isStale = !lastFinishedAt || Date.now() - lastFinishedAt.getTime() > ttlMinutes * 60 * 1000;
    const mustHaveRealEvents = sporlyCount === 0;

    if (!count || isStale || mustHaveRealEvents) {
      try {
        await this.syncExternalEvents();
      } catch (error) {
        if (!count || mustHaveRealEvents) {
          throw error;
        }
      }
    }
  }

  private async ensureFavoritesSupport() {
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS event_favorites (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, event_id)
      )
    `);

    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_event_favorites_user_created_at
      ON event_favorites (user_id, created_at DESC)
    `);
  }

  private async ensureEventExists(eventId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      `SELECT id FROM events WHERE id = $1 AND is_hidden = FALSE AND is_archived = FALSE`,
      [eventId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException("Event not found");
    }
  }

  private async fetchSporlyEvents() {
    const baseUrl = this.configService.get<string>("SPORLY_EVENTS_URL") ?? "https://sporly.ru/api/events";
    const pageSize = Number(this.configService.get<string>("SPORLY_PAGE_SIZE") ?? "100");
    const dateFrom = this.getMoscowToday();

    const firstPage = await this.fetchSporlyPage(baseUrl, dateFrom, pageSize, 1);
    const totalPages = Math.max(1, firstPage.total_pages || 1);
    const items = [...firstPage.items];

    for (let page = 2; page <= totalPages; page += 1) {
      const response = await this.fetchSporlyPage(baseUrl, dateFrom, pageSize, page);
      items.push(...response.items);
    }

    return items
      .map((item) => this.normalizeSporlyEvent(item))
      .filter((item): item is NormalizedExternalEvent => item !== null);
  }

  private async fetchSporlyPage(baseUrl: string, dateFrom: string, pageSize: number, page: number) {
    const url = new URL(baseUrl);
    url.searchParams.set("date_from", dateFrom);
    url.searchParams.set("sort_by", "date_asc");
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Sporly API request failed with status ${response.status}`);
    }

    return (await response.json()) as SporlyResponse;
  }

  private normalizeSporlyEvent(event: SporlyEvent): NormalizedExternalEvent | null {
    const startsAt = this.resolveSporlyStartsAt(event);

    if (!startsAt) {
      return null;
    }

    return {
      sourceName: "sporly",
      sourceEventId: event.id,
      title: event.title,
      description: event.description,
      sportType: this.mapSportType(event.category),
      region: event.region,
      city: event.city,
      venue: event.venue,
      startsAt,
      registrationUrl: event.source_url,
      sourceUrl: event.source_url,
      imageUrl: event.image_url,
      metadata: {
        sourceLabel: event.source_label ?? null,
        upstreamSourceName: event.source_name,
        upstreamSourceType: event.source_type ?? null,
        organizerName: event.organizer_name ?? null,
        category: event.category ?? null,
        dateText: event.date_text ?? null,
      },
    };
  }

  private resolveSporlyStartsAt(event: SporlyEvent) {
    if (event.starts_at) {
      return event.starts_at;
    }

    const candidates = [event.date_text, event.title];

    for (const candidate of candidates) {
      const parsed = this.extractDateFromText(candidate);

      if (parsed) {
        return `${parsed}T00:00:00+03:00`;
      }
    }

    return null;
  }

  private extractDateFromText(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);

    if (!match) {
      return null;
    }

    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  private mapSportType(category: string | null) {
    const value = (category ?? "").toLowerCase();

    if (value.includes("триат")) return "triathlon";
    if (value.includes("вело")) return "cycling";
    if (value.includes("плав")) return "swimming";
    if (value.includes("лыж")) return "skiing";
    if (value.includes("ходьб")) return "walking";
    if (value.includes("ориент")) return "orienteering";
    if (value.includes("бег")) return "running";

    return "other";
  }

  private getMoscowToday() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === "year")?.value ?? "1970";
    const month = parts.find((part) => part.type === "month")?.value ?? "01";
    const day = parts.find((part) => part.type === "day")?.value ?? "01";

    return `${year}-${month}-${day}`;
  }

  private mapEvent(row: EventRow) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      sportType: row.sport_type,
      region: row.region,
      city: row.city,
      venue: row.venue,
      startsAt: new Date(row.starts_at).toISOString(),
      registrationUrl: row.registration_url,
      sourceUrl: row.source_url,
      imageUrl: row.image_url,
      sourceName: row.source_name,
      sourceEventId: row.source_event_id,
      participationStatus: row.participation_status ?? null,
      isFavorite: Boolean(row.is_favorite),
    };
  }
}
