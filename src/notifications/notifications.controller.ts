import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import type { JwtPayloadAcces } from '../auth/interfaces/jwt-payload.interface.js';
import { ListerNotificationsQueryDto } from './dto/lister-notifications-query.dto.js';
import { NotificationsService } from './notifications.service.js';

// Un id mal formé est traité comme une notification introuvable (404), pas
// comme une erreur de validation : aucune différence observable avec un id
// inconnu ou appartenant à un collègue.
const idNotification = () =>
  new ParseUUIDPipe({
    exceptionFactory: () => new NotFoundException('Notification introuvable.'),
  });

/**
 * Directeur et Membre ont les mêmes droits (aucun @Roles) : chacun ne voit et
 * ne modifie que SES notifications. Le destinataire vient du JWT, jamais du client.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  lister(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Query() query: ListerNotificationsQueryDto,
  ) {
    return this.notifications.lister(utilisateur.sub, query);
  }

  // Déclarée avant les routes en `:id` par lisibilité (aucun conflit : GET
  // `:id` n'existe pas).
  @Get('non-lues/compteur')
  @Header('Cache-Control', 'private, no-store')
  compteur(@UtilisateurCourant() utilisateur: JwtPayloadAcces) {
    return this.notifications.compteurNonLues(utilisateur.sub);
  }

  @Post('tout-lire')
  @HttpCode(200)
  toutLire(@UtilisateurCourant() utilisateur: JwtPayloadAcces) {
    return this.notifications.toutLire(utilisateur.sub);
  }

  @Patch(':id/lue')
  marquerLue(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idNotification()) id: string,
  ) {
    return this.notifications.marquerLue(utilisateur.sub, id);
  }

  @Patch(':id/non-lue')
  marquerNonLue(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idNotification()) id: string,
  ) {
    return this.notifications.marquerNonLue(utilisateur.sub, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async supprimer(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idNotification()) id: string,
  ): Promise<void> {
    await this.notifications.supprimer(utilisateur.sub, id);
  }
}
