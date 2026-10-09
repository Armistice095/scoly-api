import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ArchivesController } from './archives.controller.js';
import { ArchivesService } from './archives.service.js';

@Module({
  imports: [AuthModule, StorageModule, DocumentsModule, NotificationsModule],
  controllers: [ArchivesController],
  providers: [ArchivesService],
})
export class ArchivesModule {}
