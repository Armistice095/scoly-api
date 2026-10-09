import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { BrevoMailProvider } from './providers/brevo-mail.provider.js';
import { MAIL_PROVIDER } from './interfaces/mail-provider.interface.js';

/**
 * Expose MailService aux autres modules (AuthModule notamment).
 * Pour changer de fournisseur d'e-mail plus tard : remplacer `useClass`
 * ci-dessous par une nouvelle classe implémentant MailProvider.
 */
@Module({
  providers: [
    MailService,
    { provide: MAIL_PROVIDER, useClass: BrevoMailProvider },
  ],
  exports: [MailService],
})
export class MailModule {}
