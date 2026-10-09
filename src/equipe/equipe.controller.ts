import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import type { JwtPayloadAcces } from '../auth/interfaces/jwt-payload.interface.js';
import { EquipeService } from './equipe.service.js';
import { InviterDto } from './dto/inviter.dto.js';

@Controller('equipe')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DIRECTEUR')
export class EquipeController {
  constructor(private readonly equipeService: EquipeService) {}

  @Get()
  lister(@UtilisateurCourant() utilisateur: JwtPayloadAcces) {
    return this.equipeService.lister(utilisateur.etablissementId);
  }

  @Post('inviter')
  inviter(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Body() dto: InviterDto,
  ) {
    return this.equipeService.inviter(utilisateur.etablissementId, dto);
  }

  @Post(':id/renvoyer-invitation')
  renvoyerInvitation(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id') id: string,
  ) {
    return this.equipeService.renvoyerInvitation(
      utilisateur.etablissementId,
      id,
    );
  }

  @Patch(':id/desactiver')
  desactiver(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id') id: string,
  ) {
    return this.equipeService.changerActivation(
      utilisateur.etablissementId,
      id,
      false,
    );
  }

  @Patch(':id/reactiver')
  reactiver(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id') id: string,
  ) {
    return this.equipeService.changerActivation(
      utilisateur.etablissementId,
      id,
      true,
    );
  }
}
