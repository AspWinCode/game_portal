import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@game-game/shared";
import { SESSION_COOKIE_NAME } from "./auth.constants.js";
import { assertTrustedOrigin } from "./auth-security.js";
import type { AuthRequest } from "./auth.types.js";
import { getCookieValue } from "./cookie.utils.js";
import { ROLES_KEY } from "./roles.decorator.js";
import { AuthService } from "../modules/services/auth.service.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const cookieToken = getCookieValue(request.headers.cookie, SESSION_COOKIE_NAME);

    if (cookieToken) {
      const session = await this.authService.getSessionByToken(cookieToken);
      if (session) {
        request.session = session;
        request.user = session.user;
        await this.authService.touchSession(cookieToken);
      }
    }

    if (!requiredRoles?.length) {
      return true;
    }

    const role = request.user?.role;
    if (!role) {
      throw new UnauthorizedException("Authentication required");
    }

    assertTrustedOrigin(request);

    return requiredRoles.includes(role);
  }
}
