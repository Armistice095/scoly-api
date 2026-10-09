/**
 * Constantes de la vérification publique. Les valeurs documentées dans
 * docs/API_VERIFICATION.md et docs/openapi-verification.yaml sont contrôlées
 * contre ce fichier par contrat.spec.ts : impossible qu'elles divergent sans
 * qu'un test échoue.
 */

export const RESULTATS = ['VALIDE', 'ANNULE', 'INTROUVABLE', 'AMBIGU'] as const;
export type Resultat = (typeof RESULTATS)[number];

export const CANAUX = ['QR', 'SAISIE'] as const;
export type Canal = (typeof CANAUX)[number];

/** Codes d'erreur du contrat (champ `code` des réponses 4xx/5xx). */
export const CODES_ERREUR = {
  CHAMP_VIDE: 'CHAMP_VIDE',
  FORMAT_INVALIDE: 'FORMAT_INVALIDE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TROP_DE_REQUETES: 'TROP_DE_REQUETES',
  ERREUR_SERVEUR: 'ERREUR_SERVEUR',
} as const;

/** Une référence imprimée dépasse rarement 60 caractères. */
export const REFERENCE_LONGUEUR_MAX = 120;
export const ETABLISSEMENT_LONGUEUR_MAX = 150;
/** Garde-fou de taille avant toute validation métier (au-delà : 400 VALIDATION_ERROR). */
export const SAISIE_LONGUEUR_ABSOLUE_MAX = 2_000;

/** Le pays n'est pas porté par le modèle Etablissement (cf. commentaire du schéma). */
export const PAYS = 'République du Bénin';

/**
 * Documents candidats lus pour une même référence normalisée. Une collision
 * entre écoles est exceptionnelle : au-delà, le résultat est AMBIGU de toute
 * façon, inutile de tout charger.
 */
export const CANDIDATS_MAX = 5;

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

/**
 * Limitation de débit PAR IP (IPv6 regroupée par /64). La saisie manuelle est
 * le canal énumérable (références séquentielles) : elle est bien plus
 * restreinte que le QR, dont le jeton de 192 bits ne se devine pas.
 */
export const LIMITES = {
  saisie: {
    minute: { limite: 10, ttl: MINUTE, blocage: MINUTE },
    heure: { limite: 40, ttl: HEURE, blocage: 10 * MINUTE },
  },
  qr: {
    minute: { limite: 30, ttl: MINUTE, blocage: MINUTE },
    heure: { limite: 200, ttl: HEURE, blocage: 10 * MINUTE },
  },
} as const;

/**
 * Ralentissement progressif (partagé entre instances, car lu dans le journal
 * en base) : au-delà de ce nombre d'échecs de saisie (INTROUVABLE ou AMBIGU)
 * dans la fenêtre, l'IP reçoit 429 jusqu'à ce que la fenêtre se vide.
 */
export const ECHECS_SAISIE_MAX = 15;
export const FENETRE_ECHECS_MS = 10 * MINUTE;

/** Durée de conservation du journal des vérifications. */
export const RETENTION_JOURNAL_JOURS = 90;
