import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { MailModule } from '../mail/mail.module.js';
import { VerificationModule } from '../verification/verification.module.js';
import { EquipeController } from './equipe.controller.js';
import { InvitationController } from './invitation.controller.js';
import { EquipeService } from './equipe.service.js';

@Module({
  imports: [AuthModule, MailModule, VerificationModule, NotificationsModule],
  controllers: [EquipeController, InvitationController],
  providers: [EquipeService],
})
export class EquipeModule {}
