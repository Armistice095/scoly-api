import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import type { JwtPayloadAcces } from '../auth/interfaces/jwt-payload.interface.js';
import { optionsUploadImage } from '../storage/image-upload.options.js';
import { EtablissementService } from './etablissement.service.js';
import { MettreAJourEtablissementDto } from './dto/mettre-a-jour-etablissement.dto.js';

@Controller('etablissement')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EtablissementController {
  constructor(private readonly etablissementService: EtablissementService) {}

  /** Tout membre authentifié de l'établissement peut consulter ces informations. */
  @Get()
  recuperer(@UtilisateurCourant() utilisateur: JwtPayloadAcces) {
    return this.etablissementService.recuperer(utilisateur.etablissementId);
  }

  /** Réservé au Directeur : ce sont les paramètres qui apparaissent sur tous les documents émis. */
  @Patch()
  @Roles('DIRECTEUR')
  mettreAJour(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Body() dto: MettreAJourEtablissementDto,
  ) {
    return this.etablissementService.mettreAJour(
      utilisateur.etablissementId,
      dto,
    );
  }

  @Post('images/:type')
  @Roles('DIRECTEUR')
  @UseInterceptors(FileInterceptor('fichier', optionsUploadImage))
  televerserImage(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('type') type: string,
    @UploadedFile() fichier?: Express.Multer.File,
  ) {
    if (!EtablissementService.estTypeImageValide(type)) {
      throw new BadRequestException(
        "Type d'image invalide (logo, signature ou cachet attendu).",
      );
    }

    return this.etablissementService.televerserImage(
      utilisateur.etablissementId,
      type,
      fichier,
    );
  }
}
