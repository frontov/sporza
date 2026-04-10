import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";

import { AuthUser } from "../../common/auth-user";
import { IS_PUBLIC_ROUTE } from "../../common/public-route";
import { DatabaseService } from "../../infrastructure/database/database.service";

type JwtPayload = {
  sub: string;
  email: string;
  role: "user" | "admin";
  sessionId: string;
  type: "access" | "refresh";
};

type LoadUserFailure =
  | { kind: "jwt_expired" }
  | { kind: "jwt_invalid" }
  | { kind: "wrong_token_type" }
  | { kind: "invalid_session" };

type RequestWithUser = {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (isPublic) {
      await this.tryAttachUser(request);
      return true;
    }

    await this.requireUser(request);
    return true;
  }

  private getBearerToken(request: RequestWithUser): string | null {
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!value?.startsWith("Bearer ")) {
      return null;
    }
    return value.slice("Bearer ".length);
  }

  private async tryAttachUser(request: RequestWithUser): Promise<void> {
    const token = this.getBearerToken(request);
    if (!token) {
      return;
    }

    const result = await this.loadUserFromAccessToken(token);
    if (result.ok) {
      request.user = result.user;
    }
  }

  private async requireUser(request: RequestWithUser): Promise<void> {
    const token = this.getBearerToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const result = await this.loadUserFromAccessToken(token);
    if (result.ok) {
      request.user = result.user;
      return;
    }

    this.throwForFailure(result.failure);
  }

  private throwForFailure(failure: LoadUserFailure): never {
    switch (failure.kind) {
      case "jwt_expired":
        throw new UnauthorizedException("Access token expired");
      case "jwt_invalid":
        throw new UnauthorizedException("Invalid access token");
      case "wrong_token_type":
        throw new UnauthorizedException("Invalid token type");
      case "invalid_session":
        throw new UnauthorizedException("Session is invalid");
      default:
        throw new UnauthorizedException("Authentication required");
    }
  }

  private async loadUserFromAccessToken(
    token: string,
  ): Promise<{ ok: true; user: AuthUser } | { ok: false; failure: LoadUserFailure }> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "change-me",
      });
    } catch (error: unknown) {
      const name =
        error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
      if (name === "TokenExpiredError") {
        return { ok: false, failure: { kind: "jwt_expired" } };
      }
      if (name === "JsonWebTokenError") {
        return { ok: false, failure: { kind: "jwt_invalid" } };
      }
      throw error;
    }

    if (payload.type !== "access") {
      return { ok: false, failure: { kind: "wrong_token_type" } };
    }

    const sessionResult = await this.databaseService.query<{
      user_id: string;
      email: string;
      role: "user" | "admin";
      is_blocked: boolean;
    }>(
      `
        SELECT s.user_id, u.email, u.role, u.is_blocked
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = $1
          AND s.user_id = $2
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
      `,
      [payload.sessionId, payload.sub],
    );

    const session = sessionResult.rows[0];

    if (!session || session.is_blocked) {
      return { ok: false, failure: { kind: "invalid_session" } };
    }

    return {
      ok: true,
      user: {
        userId: session.user_id,
        email: session.email,
        role: session.role,
        sessionId: payload.sessionId,
        tokenType: "access",
      },
    };
  }
}
