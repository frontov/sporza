import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AuthUser } from "../../common/auth-user";
import { ROLES_KEY } from "../../common/roles";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<"user" | "admin">>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();

    if (!request.user || !requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
