import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";

import { DatabaseService } from "../../infrastructure/database/database.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";

interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: "user" | "admin";
  is_blocked: boolean;
  username: string;
  full_name: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    return this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{ email: string; username: string }>(
        `
          SELECT u.email, p.username
          FROM users u
          FULL JOIN profiles p ON p.user_id = u.id
          WHERE u.email = $1 OR p.username = $2
        `,
        [dto.email.toLowerCase(), dto.username],
      );

      if (existing.rows.some((row: { email: string; username: string }) => row.email?.toLowerCase() === dto.email.toLowerCase())) {
        throw new ConflictException("Email already in use");
      }

      if (existing.rows.some((row: { email: string; username: string }) => row.username === dto.username)) {
        throw new ConflictException("Username already in use");
      }

      const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

      const insertedUser = await client.query<{ id: string; email: string; role: "user" | "admin" }>(
        `
          INSERT INTO users (email, password_hash)
          VALUES ($1, $2)
          RETURNING id, email, role
        `,
        [dto.email.toLowerCase(), passwordHash],
      );

      const user = insertedUser.rows[0];

      await client.query(
        `
          INSERT INTO profiles (user_id, username, full_name, sports)
          VALUES ($1, $2, $3, '[]'::jsonb)
        `,
        [user.id, dto.username, dto.fullName],
      );

      const sessionId = randomUUID();
      const tokens = await this.issueTokens(user.id, user.email, user.role, sessionId);
      await this.createSession(client, sessionId, user.id, tokens.refreshToken);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          username: dto.username,
          fullName: dto.fullName,
          role: user.role,
        },
      };
    });
  }

  async login(dto: LoginDto) {
    const result = await this.databaseService.query<UserRecord>(
      `
        SELECT
          u.id,
          u.email,
          u.password_hash,
          u.role,
          u.is_blocked,
          p.username,
          p.full_name
        FROM users u
        JOIN profiles p ON p.user_id = u.id
        WHERE u.email = $1
      `,
      [dto.email.toLowerCase()],
    );

    const user = result.rows[0];

    if (!user || !(await argon2.verify(user.password_hash, dto.password)) || user.is_blocked) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.databaseService.withTransaction(async (client) => {
      const sessionId = randomUUID();
      const tokens = await this.issueTokens(user.id, user.email, user.role, sessionId);
      await this.createSession(client, sessionId, user.id, tokens.refreshToken);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
        },
      };
    });
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      email: string;
      role: "user" | "admin";
      sessionId: string;
      type: "refresh";
    }>(dto.refreshToken, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET") ?? "change-me-too",
    });

    const result = await this.databaseService.query<{
      id: string;
      user_id: string;
      refresh_token_hash: string;
      email: string;
      role: "user" | "admin";
      username: string;
      full_name: string;
      is_blocked: boolean;
    }>(
      `
        SELECT
          s.id,
          s.user_id,
          s.refresh_token_hash,
          u.email,
          u.role,
          u.is_blocked,
          p.username,
          p.full_name
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        JOIN profiles p ON p.user_id = u.id
        WHERE s.id = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
      `,
      [payload.sessionId],
    );

    const session = result.rows[0];

    if (!session || session.is_blocked || !(await argon2.verify(session.refresh_token_hash, dto.refreshToken))) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.databaseService.withTransaction(async (client) => {
      await client.query(`UPDATE sessions SET revoked_at = NOW() WHERE id = $1`, [session.id]);
      const sessionId = randomUUID();
      const tokens = await this.issueTokens(session.user_id, session.email, session.role, sessionId);
      await this.createSession(client, sessionId, session.user_id, tokens.refreshToken);
      return {
        ...tokens,
        user: {
          id: session.user_id,
          email: session.email,
          username: session.username,
          fullName: session.full_name,
          role: session.role,
        },
      };
    });
  }

  private async createSession(client: PoolClient, sessionId: string, userId: string, refreshToken: string) {
    const refreshTokenHash = await argon2.hash(refreshToken, { type: argon2.argon2id });
    const refreshDays = Number(this.configService.get<string>("JWT_REFRESH_TTL_DAYS") ?? "30");

    await client.query(
      `
        INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at)
        VALUES ($1, $2, $3, NOW() + ($4 || ' days')::interval)
      `,
      [sessionId, userId, refreshTokenHash, String(refreshDays)],
    );
  }

  private async issueTokens(userId: string, email: string, role: "user" | "admin", sessionId: string) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, role, sessionId, type: "access" },
      {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "change-me",
        expiresIn: (this.configService.get<string>("JWT_ACCESS_TTL") ?? "15m") as never,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email, role, sessionId, type: "refresh" },
      {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET") ?? "change-me-too",
        expiresIn: (this.configService.get<string>("JWT_REFRESH_TTL") ?? "30d") as never,
      },
    );
    return {
      accessToken,
      refreshToken,
    };
  }
}
