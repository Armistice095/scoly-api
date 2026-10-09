import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { JwtPayloadAcces } from '../interfaces/jwt-payload.interface.js';

/**
 * Doit toujours être posé APRÈS JwtAuthGuard dans @UseGuards (c'est lui qui
 * remplit request.utilisateur). Sans @Roles(...) sur la route, laisse
 * passer n'importe quel utilisateur authentifié.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequis = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesRequis || rolesRequis.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { utilisateur?: JwtPayloadAcces }>();
    const role = request.utilisateur?.role;

    if (!role || !rolesRequis.includes(role)) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits nécessaires pour cette action.",
      );
    }

    return true;
  }
}
