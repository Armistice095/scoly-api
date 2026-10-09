import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EmailAEnvoyer,
  MailProvider,
} from '../interfaces/mail-provider.interface.js';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Fournisseur d'e-mail basé sur l'API transactionnelle Brevo.
 *
 * On appelle l'API REST directement via `fetch` plutôt que d'ajouter le SDK
 * `@getbrevo/brevo` : un seul endpoint est utilisé, ça évite une dépendance
 * supplémentaire pour un besoin simple (cohérent avec le principe de
 * simplicité du projet, cf. ARCHITECTURE.md).
 */
@Injectable()
export class BrevoMailProvider implements MailProvider {
  private readonly logger = new Logger(BrevoMailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async envoyer(email: EmailAEnvoyer): Promise<void> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const expediteurEmail = this.config.get<string>('MAIL_FROM_EMAIL');
    const expediteurNom = this.config.get<string>('MAIL_FROM_NOM') ?? 'Scoly';

    if (!apiKey || !expediteurEmail) {
      // Erreur de configuration, pas de l'utilisateur : on log en détail
      // mais on renvoie un message générique côté client.
      this.logger.error(
        'BREVO_API_KEY ou MAIL_FROM_EMAIL manquant dans la configuration.',
      );
      throw new ServiceUnavailableException(
        "L'envoi de l'e-mail a échoué. Veuillez réessayer.",
      );
    }

    const reponse = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: expediteurEmail, name: expediteurNom },
        to: [{ email: email.destinataire }],
        subject: email.sujet,
        htmlContent: email.html,
        textContent: email.texte,
      }),
    });

    if (!reponse.ok) {
      const corps = await reponse.text().catch(() => '(corps illisible)');
      this.logger.error(
        `Échec de l'envoi Brevo (HTTP ${reponse.status}) vers ${email.destinataire} : ${corps}`,
      );
      throw new ServiceUnavailableException(
        "L'envoi de l'e-mail a échoué. Veuillez réessayer.",
      );
    }
  }
}
