import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Les modules métier (Documents, Archives, Équipe) produisent les notifications.
  exports: [NotificationsService],
})
export class NotificationsModule {}
