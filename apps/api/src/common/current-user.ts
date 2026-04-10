import { UnauthorizedException, createParamDecorator, ExecutionContext } from "@nestjs/common";

import { AuthUser } from "./auth-user";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();

  if (!request.user) {
    throw new UnauthorizedException("Authentication required");
  }

  return request.user;
});

export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();

  if (!request.user) {
    throw new UnauthorizedException("Authentication required");
  }

  return request.user.userId;
});

export const OptionalUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | null => {
  const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
  return request.user ?? null;
});
