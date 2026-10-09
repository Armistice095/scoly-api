import { Inject, Injectable } from '@nestjs/common';
import {
  MAIL_PROVIDER,
  type MailProvider,
} from './interfaces/mail-provider.interface.js';
import {
  genererEmailCode,
  type ContexteCode,
} from './templates/verification-code.template.js';
import { genererEmailInvitation } from './templates/invitation.template.js';

@Injectable()
export class MailService {
  constructor(@Inject(MAIL_PROVIDER) private readonly provider: MailProvider) {}

  /**
   * Envoie un code de vérification à 6 chiffres pour le contexte donné
   * (activation de compte ou réinitialisation de mot de passe).
   */
  async envoyerCodeVerification(
    destinataire: string,
    code: string,
    contexte: ContexteCode,
  ): Promise<void> {
    const { sujet, html, texte } = genererEmailCode(code, contexte);
    await this.provider.envoyer({ destinataire, sujet, html, texte });
  }

  /** Envoie le lien d'invitation à rejoindre l'équipe d'un établissement. */
  async envoyerInvitation(
    destinataire: string,
    lien: string,
    etablissementNom: string,
    fonction: string,
  ): Promise<void> {
    const { sujet, html, texte } = genererEmailInvitation(
      lien,
      etablissementNom,
      fonction,
    );
    await this.provider.envoyer({ destinataire, sujet, html, texte });
  }
}
