import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../../auth/decorators/utilisateur-courant.decorator.js';
import type { JwtPayloadAcces } from '../../auth/interfaces/jwt-payload.interface.js';
import { AnneeScolaireService } from './annee-scolaire.service.js';
import { CreerAnneeScolaireDto } from './dto/creer-annee-scolaire.dto.js';
import { ModifierAnneeScolaireDto } from './dto/modifier-annee-scolaire.dto.js';

@Controller('etablissement/annees-scolaires')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnneeScolaireController {
  constructor(private readonly anneeScolaireService: AnneeScolaireService) {}

  @Get()
  lister(@UtilisateurCourant() utilisateur: JwtPayloadAcces) {
    return this.anneeScolaireService.lister(utilisateur.etablissementId);
  }

  @Post()
  @Roles('DIRECTEUR')
  creer(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Body() dto: CreerAnneeScolaireDto,
  ) {
    return this.anneeScolaireService.creer(utilisateur.etablissementId, dto);
  }

  @Patch(':id')
  @Roles('DIRECTEUR')
  modifier(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id') id: string,
    @Body() dto: ModifierAnneeScolaireDto,
  ) {
    return this.anneeScolaireService.modifier(
      utilisateur.etablissementId,
      id,
      dto,
    );
  }

  @Patch(':id/activer')
  @Roles('DIRECTEUR')
  activer(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id') id: string,
  ) {
    return this.anneeScolaireService.activer(utilisateur.etablissementId, id);
  }
}
