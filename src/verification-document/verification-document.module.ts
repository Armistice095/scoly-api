import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { JournalVerificationService } from './journal-verification.service.js';
import {
  LimiteVerificationGuard,
  THROTTLERS_VERIFICATION,
} from './limiteur-verification.js';
import { VerificationDocumentController } from './verification-document.controller.js';
import { VerificationDocumentService } from './verification-document.service.js';

/** Le statut d'un document peut passer d'Actif à Annulé : jamais de cache, ni navigateur ni intermédiaire. */
export function pasDeCache(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * Vérification publique d'un document (QR code ou référence saisie).
 * (À ne pas confondre avec src/verification/, qui gère les codes e-mail.)
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: THROTTLERS_VERIFICATION,
      // Ne pas révéler les seuils (X-RateLimit-*) ; Retry-After est posé par le filtre.
      setHeaders: false,
      errorMessage: 'Trop de requêtes.',
    }),
  ],
  controllers: [VerificationDocumentController],
  providers: [
    VerificationDocumentService,
    JournalVerificationService,
    LimiteVerificationGuard,
  ],
})
export class VerificationDocumentModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // En-têtes de sécurité limités à CETTE route : l'activer globalement
    // (X-Frame-Options, Cross-Origin-Resource-Policy…) casserait l'aperçu des
    // PDF des autres modules, ce qui sort du périmètre de cette fonctionnalité.
    consumer
      .apply(helmet(), pasDeCache)
      .forRoutes(VerificationDocumentController);
  }
}
