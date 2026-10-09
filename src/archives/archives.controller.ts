import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import type { JwtPayloadAcces } from '../auth/interfaces/jwt-payload.interface.js';
import { ArchivesService } from './archives.service.js';
import { AnnulerDocumentDto } from './dto/annuler-document.dto.js';
import { ListerArchivesQueryDto } from './dto/lister-archives-query.dto.js';

// Un id mal formé est traité comme un document introuvable (404), pas comme
// une erreur de validation : le front n'a qu'un cas à gérer.
const idDocument = () =>
  new ParseUUIDPipe({
    exceptionFactory: () => new NotFoundException('Document introuvable.'),
  });

/**
 * Directeur et Membre ont les mêmes droits ici (aucun @Roles), annulation
 * comprise. L'isolation entre établissements repose sur
 * `utilisateur.etablissementId` (issu du JWT, jamais du client).
 */
@Controller('archives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArchivesController {
  constructor(private readonly archivesService: ArchivesService) {}

  @Get()
  lister(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Query() query: ListerArchivesQueryDto,
  ) {
    return this.archivesService.lister(utilisateur.etablissementId, query);
  }

  @Get(':id')
  recuperer(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idDocument()) id: string,
  ) {
    return this.archivesService.recuperer(utilisateur.etablissementId, id);
  }

  /** Motif obligatoire. Renvoie la fiche mise à jour (statut, annulation, historique). */
  @Post(':id/annulation')
  @HttpCode(200)
  annuler(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idDocument()) id: string,
    @Body() dto: AnnulerDocumentDto,
  ) {
    return this.archivesService.annuler(
      utilisateur.etablissementId,
      utilisateur.sub,
      id,
      dto,
    );
  }

  /** Lien signé (1 h) qui enregistre le PDF. Tracé dans l'historique ; 409 si le document est annulé. */
  @Get(':id/telechargement')
  telecharger(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idDocument()) id: string,
  ) {
    return this.archivesService.urlTelechargement(
      utilisateur.etablissementId,
      utilisateur.sub,
      id,
    );
  }

  /** Le PDF lui-même, pour l'afficher dans la modale « Aperçu ». Non tracé ; disponible même si annulé. */
  @Get(':id/apercu')
  @Header('Content-Type', 'application/pdf')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async apercu(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idDocument()) id: string,
  ) {
    const { pdf, nomFichier } = await this.archivesService.apercu(
      utilisateur.etablissementId,
      id,
    );
    return new StreamableFile(pdf, {
      disposition: `inline; filename="${nomFichier}"`,
    });
  }
}
