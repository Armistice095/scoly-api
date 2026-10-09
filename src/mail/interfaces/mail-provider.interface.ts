/**
 * Contrat qu'un fournisseur d'envoi d'e-mails doit respecter.
 *
 * Le reste de l'application (MailService, AuthService, ...) ne dépend
 * jamais directement de Brevo : uniquement de cette interface. Changer de
 * fournisseur (Resend, SES, ...) plus tard = écrire une nouvelle classe qui
 * l'implémente, sans toucher au reste du code.
 */
export interface EmailAEnvoyer {
  destinataire: string;
  sujet: string;
  html: string;
  texte: string;
}

export interface MailProvider {
  envoyer(email: EmailAEnvoyer): Promise<void>;
}

/** Jeton d'injection NestJS pour l'implémentation active de MailProvider. */
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
