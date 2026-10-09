import type { RoleUtilisateur } from '@prisma/client';

/** Payload des tokens d'accès et de rafraîchissement. */
export interface JwtPayloadAcces {
  sub: string; // id utilisateur
  etablissementId: string;
  // Dénormalisé dans le token plutôt que relu en base à chaque requête
  // gardée : acceptable vu la courte durée de vie du token d'accès (15 min
  // par défaut). Un changement de rôle met donc jusqu'à 15 min à s'appliquer
  // pleinement — à revoir si ça devient un problème réel.
  role: RoleUtilisateur;
}

/**
 * Payload du jeton de réinitialisation de mot de passe, délivré après
 * vérification du code à 6 chiffres. Volontairement sans `etablissementId`
 * pour qu'il ne puisse jamais être confondu avec un token d'accès par
 * JwtAuthGuard (qui exige les deux champs de JwtPayloadAcces).
 */
export interface JwtPayloadReset {
  sub: string; // id utilisateur
  but: 'reset_mot_de_passe';
}
