import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import type { JwtPayloadAcces } from '../auth/interfaces/jwt-payload.interface.js';
import { CreerDocumentDto } from './dto/creer-document.dto.js';
import { DocumentsService } from './documents.service.js';

const idDocument = () =>
  new ParseUUIDPipe({
    exceptionFactory: () => new NotFoundException('Document introuvable.'),
  });

/** Directeur et Membre ont les mêmes droits ici (aucun @Roles). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /** Écran « Documents » : les types, leurs catégories et la description de leurs champs. */
  @Get('types-documents')
  listerTypes() {
    return this.documentsService.listerTypes();
  }

  /**
   * Aperçu : renvoie le vrai PDF (même modèle que le document final), filigrané
   * « APERÇU ». N'écrit rien et ne consomme aucun numéro.
   */
  @Post('documents/apercu')
  @HttpCode(200)
  @Header('Content-Type', 'application/pdf')
  @Header('Cache-Control', 'no-store')
  async apercu(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Body() dto: CreerDocumentDto,
  ) {
    const { pdf, nomFichier } = await this.documentsService.apercu(
      utilisateur.etablissementId,
      dto,
    );
    return new StreamableFile(pdf, {
      disposition: `inline; filename="apercu_${nomFichier}"`,
    });
  }

  /**
   * Génération réelle : attribue le numéro, fige le PDF, l'enregistre.
   * `Idempotency-Key` (UUID, généré par le front à l'ouverture du formulaire)
   * évite les doublons en cas de double-clic ou de nouvel essai.
   */
  @Post('documents')
  creer(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Body() dto: CreerDocumentDto,
    @Headers('idempotency-key') cle?: string,
  ) {
    if (cle !== undefined && !isUUID(cle)) {
      throw new BadRequestException({
        message: 'Idempotency-Key doit être un UUID.',
        code: 'IDEMPOTENCY_KEY_INVALIDE',
      });
    }
    return this.documentsService.creer(
      utilisateur.etablissementId,
      utilisateur.sub,
      dto,
      cle,
    );
  }

  /** Nouvelle URL signée (1 h) pour re-télécharger le PDF d'un document déjà généré (tracé ; refusé si le document est annulé). */
  @Get('documents/:id/telechargement')
  telecharger(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idDocument()) id: string,
  ) {
    return this.documentsService.urlTelechargement(
      utilisateur.etablissementId,
      utilisateur.sub,
      id,
    );
  }
}
