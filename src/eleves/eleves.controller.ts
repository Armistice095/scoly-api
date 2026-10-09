import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import type { JwtPayloadAcces } from '../auth/interfaces/jwt-payload.interface.js';
import { ElevesService } from './eleves.service.js';
import { ElevesImportService } from './import/eleves-import.service.js';
import { optionsUploadExcel } from './import/options-upload-excel.js';
import { CreerEleveDto } from './dto/creer-eleve.dto.js';
import { ModifierEleveDto } from './dto/modifier-eleve.dto.js';
import { ListerElevesQueryDto } from './dto/lister-eleves-query.dto.js';

// Un id mal formé est traité comme un élève introuvable (404), pas comme une
// erreur de validation : le front n'a qu'un cas à gérer.
const idEleve = () =>
  new ParseUUIDPipe({
    exceptionFactory: () => new NotFoundException('Élève introuvable.'),
  });

/**
 * Directeur et Membre ont les mêmes droits ici : aucun @Roles. L'isolation
 * entre établissements repose sur `utilisateur.etablissementId` (issu du JWT,
 * jamais du client), transmis à chaque appel de service.
 */
@Controller('eleves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ElevesController {
  constructor(
    private readonly elevesService: ElevesService,
    private readonly importService: ElevesImportService,
  ) {}

  @Get()
  lister(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Query() query: ListerElevesQueryDto,
  ) {
    return this.elevesService.lister(utilisateur.etablissementId, query);
  }

  @Post()
  creer(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Body() dto: CreerEleveDto,
  ) {
    return this.elevesService.creer(utilisateur.etablissementId, dto);
  }

  // Routes d'import déclarées avant `:id` par prudence sur l'ordre de résolution.
  @Get('import/modele')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="modele-import-eleves.xlsx"',
  )
  async telechargerModele() {
    return new StreamableFile(await this.importService.genererModele());
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('fichier', optionsUploadExcel))
  importer(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @UploadedFile() fichier?: Express.Multer.File,
  ) {
    return this.importService.importer(utilisateur.etablissementId, fichier);
  }

  @Get(':id')
  recuperer(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idEleve()) id: string,
  ) {
    return this.elevesService.recuperer(utilisateur.etablissementId, id);
  }

  @Patch(':id')
  modifier(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Param('id', idEleve()) id: string,
    @Body() dto: ModifierEleveDto,
  ) {
    return this.elevesService.modifier(utilisateur.etablissementId, id, dto);
  }
}
