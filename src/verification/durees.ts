/**
 * Durées de validité partagées entre la logique (VerificationService) et les
 * e-mails (« valable pendant 10 minutes ») : une seule source, donc le texte
 * envoyé ne peut jamais contredire la règle réellement appliquée.
 */

/** Durée de validité d'un code, en minutes. */
export const DUREE_EXPIRATION_MINUTES = 10;

/** Durée de validité d'un jeton d'invitation, en jours (traîne plus longtemps dans une boîte mail qu'un code de connexion). */
export const DUREE_INVITATION_JOURS = 7;
