import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ElevesController } from './eleves.controller.js';
import { ElevesService } from './eleves.service.js';
import { ElevesImportService } from './import/eleves-import.service.js';

@Module({
  imports: [AuthModule], // JwtAuthGuard / RolesGuard
  controllers: [ElevesController],
  providers: [ElevesService, ElevesImportService],
  exports: [ElevesService], // utilisé plus tard par DocumentModule (sélection d'un élève)
})
export class ElevesModule {}
