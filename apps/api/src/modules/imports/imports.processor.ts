import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

import { DatabaseService } from "../../infrastructure/database/database.service";
import { ImportJobPayload, QueueService } from "../../infrastructure/queue/queue.service";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { IMPORT_SOURCE_TYPE } from "./imports.constants";
import { parseImportedActivity } from "./parsers";

@Injectable()
export class ImportsProcessor implements OnModuleInit {
  private readonly logger = new Logger(ImportsProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  onModuleInit() {
    this.queueService.registerImportWorker(async (payload) => {
      await this.process(payload);
    });
  }

  async process(payload: ImportJobPayload) {
    this.logger.log(`Processing import ${payload.importJobId}`);

    await this.databaseService.query(
      `
        UPDATE import_jobs
        SET status = 'processing', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
        WHERE id = $1
      `,
      [payload.importJobId],
    );

    try {
      const rawFile = await this.storageService.getObjectBuffer(payload.storageKey);
      const parsed = await parseImportedActivity(rawFile, payload.originalFilename, payload.fileType);

      await this.databaseService.withTransaction(async (client) => {
        const activityResult = await client.query<{ id: string }>(
          `
            INSERT INTO activities (
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
              has_route
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id
          `,
          [
            payload.userId,
            parsed.sportType,
            parsed.title,
            parsed.description,
            parsed.startedAt,
            parsed.durationSeconds,
            parsed.distanceMeters,
            parsed.elevationGainMeters,
            parsed.avgSpeedMps,
            parsed.avgPaceSecondsPerKm,
            parsed.avgHeartRate,
            parsed.calories,
            "public",
            IMPORT_SOURCE_TYPE,
            payload.fileType.toUpperCase(),
            parsed.routePoints.length > 1,
          ],
        );

        const activityId = activityResult.rows[0].id;

        if (parsed.routePoints.length > 1) {
          const bounds = this.computeBounds(parsed.routePoints);
          const lineStringWkt = this.buildLineStringWkt(parsed.routePoints);
          const startPoint = parsed.routePoints[0];
          const endPoint = parsed.routePoints[parsed.routePoints.length - 1];

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

        await client.query(
          `
            INSERT INTO activity_files (
              activity_id,
              user_id,
              storage_key,
              original_filename,
              mime_type,
              file_size_bytes,
              file_hash_sha256
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            activityId,
            payload.userId,
            payload.storageKey,
            payload.originalFilename,
            parsed.mimeType,
            rawFile.byteLength,
            payload.fileHash,
          ],
        );

        await client.query(
          `
            UPDATE import_jobs
            SET
              status = 'completed',
              activity_id = $2,
              finished_at = NOW(),
              updated_at = NOW(),
              error_code = NULL,
              error_message = NULL
            WHERE id = $1
          `,
          [payload.importJobId, activityId],
        );
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown import error";

      await this.databaseService.query(
        `
          UPDATE import_jobs
          SET
            status = 'failed',
            error_code = 'import_processing_failed',
            error_message = $2,
            finished_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [payload.importJobId, message],
      );

      this.logger.error(`Import ${payload.importJobId} failed: ${message}`);
      throw error;
    }
  }

  private buildLineStringWkt(points: Array<{ lat: number; lon: number }>) {
    return `LINESTRING(${points.map((point) => `${point.lon} ${point.lat}`).join(", ")})`;
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
}
