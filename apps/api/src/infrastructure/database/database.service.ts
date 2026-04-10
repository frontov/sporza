import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

@Injectable()
export class DatabaseService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString:
        this.configService.get<string>("DATABASE_URL") ??
        "postgresql://sporza:sporza@localhost:5432/sporza",
    });
  }

  query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async onModuleInit() {
    await this.ensureSchema();
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    await this.query("SELECT 1");
    return true;
  }

  private async ensureSchema() {
    const result = await this.query<{ exists: string | null }>(
      "SELECT to_regclass('public.users') AS exists",
    );

    if (result.rows[0]?.exists) {
      return;
    }

    const schemaPath = await this.resolveSchemaPath();
    const schemaSql = await readFile(schemaPath, "utf8");

    this.logger.log(`Applying database schema from ${schemaPath}`);
    await this.pool.query(schemaSql);
    this.logger.log("Database schema initialized");
  }

  private async resolveSchemaPath() {
    const candidates = [
      resolve(process.cwd(), "docs/db/schema.sql"),
      resolve(process.cwd(), "../../docs/db/schema.sql"),
      resolve(__dirname, "../../../../docs/db/schema.sql"),
      resolve(__dirname, "../../../../../docs/db/schema.sql"),
    ];

    for (const candidate of candidates) {
      try {
        await readFile(candidate, "utf8");
        return candidate;
      } catch {
        continue;
      }
    }

    throw new Error("Unable to locate docs/db/schema.sql for database initialization");
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
