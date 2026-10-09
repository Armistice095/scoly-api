import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { VerifierDocumentDto } from './dto/verifier-document.dto.js';
import { ErreursVerificationFilter } from './erreurs-verification.filter.js';
import { LimiteVerificationGuard } from './limiteur-verification.js';
import { VerificationDocumentService } from './verification-document.service.js';

/**
 * Page PUBLIQUE de vérification : aucun guard d'authentification, volontairement.
 *
 * POST et non GET bien que la lecture soit seule : la référence et le jeton
 * restent dans le corps, donc hors des logs d'accès, des historiques et des
 * en-têtes Referer (une référence contient des « / » et identifie un élève).
 * Les en-têtes de sécurité et `Cache-Control: no-store` sont posés par le module.
 */
@Controller('verification')
@UseGuards(LimiteVerificationGuard)
@UseFilters(ErreursVerificationFilter)
export class VerificationDocumentController {
  constructor(private readonly service: VerificationDocumentService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  verifier(@Body() dto: VerifierDocumentDto, @Req() req: Request) {
    return this.service.verifier(dto, req.ip);
  }
}
