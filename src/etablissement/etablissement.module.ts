import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { EtablissementController } from './etablissement.controller.js';
import { EtablissementService } from './etablissement.service.js';
import { AnneeScolaireController } from './annee-scolaire/annee-scolaire.controller.js';
import { AnneeScolaireService } from './annee-scolaire/annee-scolaire.service.js';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [EtablissementController, AnneeScolaireController],
  providers: [EtablissementService, AnneeScolaireService],
})
export class EtablissementModule {}
