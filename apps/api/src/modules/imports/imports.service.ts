import { Injectable, NotFoundException, UnsupportedMediaTypeException } from "@nestjs/common";
import { createHash } from "node:crypto";

import { DatabaseService } from "../../infrastructure/database/database.service";
import { QueueService } from "../../infrastructure/queue/queue.service";
import { StorageService } from "../../infrastructure/storage/storage.service";

const SUPPORTED_IMPORT_TYPES = new Set(["fit", "gpx", "tcx"]);

@Injectable()
export class ImportsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
  ) {}

  async createJob(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new UnsupportedMediaTypeException("File is required");
    }

    const fileType = this.detectFileType(file.originalname);
    const fileHash = createHash("sha256").update(file.buffer).digest("hex");
    const storageKey = this.buildStorageKey(userId, file.originalname);

    const existingActivity = await this.databaseService.query<{ activity_id: string }>(
      `
        SELECT activity_id
        FROM activity_files
        WHERE user_id = $1 AND file_hash_sha256 = $2
      `,
      [userId, fileHash],
    );

    if (existingActivity.rows[0]) {
      const result = await this.databaseService.query<{
        id: string;
        status: string;
        duplicate_of_activity_id: string | null;
        created_at: Date | string;
      }>(
        `
          INSERT INTO import_jobs (
            user_id,
            storage_key,
            original_filename,
            file_type,
            file_hash_sha256,
            status,
            duplicate_of_activity_id,
            finished_at
          )
          VALUES ($1, $2, $3, $4, $5, 'deduplicated', $6, NOW())
          RETURNING id, status, duplicate_of_activity_id, created_at
        `,
        [userId, storageKey, file.originalname, fileType, fileHash, existingActivity.rows[0].activity_id],
      );

      return this.mapJob(result.rows[0]);
    }

    await this.storageService.putObject(storageKey, file.buffer, file.mimetype);

    const result = await this.databaseService.query<{
      id: string;
      status: string;
      duplicate_of_activity_id: string | null;
      created_at: Date | string;
    }>(
      `
        INSERT INTO import_jobs (
          user_id,
          storage_key,
          original_filename,
          file_type,
          file_hash_sha256,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'queued')
        RETURNING id, status, duplicate_of_activity_id, created_at
      `,
      [userId, storageKey, file.originalname, fileType, fileHash],
    );

    const mappedJob = this.mapJob(result.rows[0]);

    if (!mappedJob) {
      throw new NotFoundException("Import job could not be created");
    }

    await this.queueService.enqueueImportJob({
      importJobId: mappedJob.id,
      userId,
      storageKey,
      originalFilename: file.originalname,
      fileType,
      fileHash,
    });

    return mappedJob;
  }

  async listJobs(userId: string) {
    const result = await this.databaseService.query<{
      id: string;
      status: string;
      duplicate_of_activity_id: string | null;
      error_code: string | null;
      error_message: string | null;
      activity_id: string | null;
      created_at: Date | string;
      updated_at: Date | string;
      original_filename: string;
    }>(
      `
        SELECT
          id,
          status,
          duplicate_of_activity_id,
          error_code,
          error_message,
          activity_id,
          created_at,
          updated_at,
          original_filename
        FROM import_jobs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [userId],
    );

    return {
      items: result.rows.map((row) => this.mapJob(row)),
    };
  }

  async getJob(userId: string, jobId: string) {
    const result = await this.databaseService.query<{
      id: string;
      status: string;
      duplicate_of_activity_id: string | null;
      error_code: string | null;
      error_message: string | null;
      activity_id: string | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `
        SELECT
          id,
          status,
          duplicate_of_activity_id,
          error_code,
          error_message,
          activity_id,
          created_at,
          updated_at
        FROM import_jobs
        WHERE id = $1 AND user_id = $2
      `,
      [jobId, userId],
    );

    const job = this.mapJob(result.rows[0]);

    if (!job) {
      throw new NotFoundException("Import job not found");
    }

    return job;
  }

  private detectFileType(filename: string) {
    const extension = filename.split(".").pop()?.toLowerCase();

    if (!extension || !SUPPORTED_IMPORT_TYPES.has(extension)) {
      throw new UnsupportedMediaTypeException("Only FIT, GPX and TCX files are supported");
    }

    return extension;
  }

  private buildStorageKey(userId: string, filename: string) {
    return `imports/${userId}/${Date.now()}-${filename}`;
  }

  private mapJob(
    row:
      | {
          id: string;
          status: string;
          duplicate_of_activity_id: string | null;
          error_code?: string | null;
          error_message?: string | null;
          activity_id?: string | null;
          created_at: Date | string;
          updated_at?: Date | string;
          original_filename?: string;
        }
      | undefined,
  ) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      status: row.status,
      duplicateOfActivityId: row.duplicate_of_activity_id ?? null,
      activityId: row.activity_id ?? null,
      errorCode: row.error_code ?? null,
      errorMessage: row.error_message ?? null,
      originalFilename: row.original_filename ?? null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }
}
