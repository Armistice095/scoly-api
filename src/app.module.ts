import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EtablissementModule } from './etablissement/etablissement.module.js';
import { EquipeModule } from './equipe/equipe.module.js';
import { ElevesModule } from './eleves/eleves.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { ArchivesModule } from './archives/archives.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { VerificationDocumentModule } from './verification-document/verification-document.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    EtablissementModule,
    EquipeModule,
    ElevesModule,
    DocumentsModule,
    ArchivesModule,
    NotificationsModule,
    VerificationDocumentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
