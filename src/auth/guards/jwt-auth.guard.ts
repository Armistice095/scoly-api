import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayloadAcces } from '../interfaces/jwt-payload.interface.js';

/**
 * Protège une route en exigeant un token d'accès valide dans l'en-tête
 * `Authorization: Bearer <token>`. Pose `request.utilisateur` (id +
 * etablissementId) pour que les controllers/services suivants puissent
 * appliquer l'isolation multi-tenant sans revalider le token eux-mêmes.
 *
 * Pas encore utilisé sur aucune route (aucun module métier n'existe
 * encore) : prêt à être posé via `@UseGuards(JwtAuthGuard)` sur les futurs
 * controllers Élèves / Documents / Établissement.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { utilisateur?: JwtPayloadAcces }>();
    const token = this.extraireToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentification requise.');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayloadAcces>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });

      // Un token de reset mot de passe n'a pas d'etablissementId : structurellement
      // impossible de l'utiliser comme token d'accès.
      if (!payload.etablissementId) {
        throw new UnauthorizedException();
      }

      request.utilisateur = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }
  }

  private extraireToken(request: Request): string | undefined {
    const enTete = request.headers.authorization;
    if (!enTete?.startsWith('Bearer ')) {
      return undefined;
    }
    return enTete.slice('Bearer '.length);
  }
}
