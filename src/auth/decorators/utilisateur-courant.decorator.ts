import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayloadAcces } from '../interfaces/jwt-payload.interface.js';

/** À utiliser uniquement sur une route protégée par JwtAuthGuard (sinon undefined). */
export const UtilisateurCourant = createParamDecorator(
  (_donnee: unknown, ctx: ExecutionContext): JwtPayloadAcces => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { utilisateur: JwtPayloadAcces }>();
    return request.utilisateur;
  },
);
