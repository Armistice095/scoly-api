import { creerExceptionChamps } from '../common/validation/erreurs-validation.js';
import { motsDeRecherche } from '../eleves/utils/recherche.js';
import { normaliserReference } from '../documents/reference-normalisee.js';
import type { VerifierDocumentDto } from './dto/verifier-document.dto.js';
import {
  CODES_ERREUR,
  ETABLISSEMENT_LONGUEUR_MAX,
  REFERENCE_LONGUEUR_MAX,
} from './constantes.js';

/** Requête nettoyée et prête à servir, quel que soit le canal. */
export type RequeteVerification =
  | { canal: 'QR'; token: string }
  | {
      canal: 'SAISIE';
      /** Référence normalisée (clé de `documents.reference_normalisee`). */
      reference: string;
      /** Mots (normalisés) du nom d'établissement fourni, ou `null`. */
      etablissement: string[] | null;
    };

const CARACTERE_DE_CONTROLE = /\p{C}/u;

const rejeter = (
  code: keyof typeof CODES_ERREUR,
  champ: string,
  message: string,
): never => {
  throw creerExceptionChamps([{ champ, message }], CODES_ERREUR[code]);
};

/** `null`, `undefined` et `""` veulent tous dire « non renseigné ». */
const renseigne = (valeur: string | null | undefined): string | undefined =>
  valeur === undefined || valeur === null || valeur === '' ? undefined : valeur;

/**
 * Valide et normalise le corps. Lève 400 `CHAMP_VIDE` ou `FORMAT_INVALIDE`.
 *
 * Volontairement PERMISSIF sur un jeton QR de mauvaise forme : il n'est pas
 * rejeté ici (ce serait distinguer « mal formé » de « inconnu » pour un
 * attaquant) mais traité comme INTROUVABLE par le service, sans requête SQL.
 */
export function lireRequete(dto: VerifierDocumentDto): RequeteVerification {
  const token = renseigne(dto.token);
  const reference = renseigne(dto.reference);

  if (token !== undefined && reference !== undefined) {
    return rejeter(
      'FORMAT_INVALIDE',
      'reference',
      'Indiquez soit la référence, soit le code du QR, pas les deux.',
    );
  }

  if (token !== undefined) return { canal: 'QR', token };

  if (reference === undefined) {
    return rejeter(
      'CHAMP_VIDE',
      // Le champ que l'utilisateur voit est la référence, sauf requête explicitement QR
      // (token présent, référence absente).
      dto.token != null && dto.reference == null ? 'token' : 'reference',
      'Veuillez saisir la référence du document.',
    );
  }

  const messageFormat =
    'La référence saisie n’est pas valide. Recopiez-la telle qu’elle figure en haut du document.';

  if (
    reference.length > REFERENCE_LONGUEUR_MAX ||
    CARACTERE_DE_CONTROLE.test(reference)
  ) {
    return rejeter('FORMAT_INVALIDE', 'reference', messageFormat);
  }

  const normalisee = normaliserReference(reference);
  // Toute référence Scoly contient le numéro d'ordre : sans chiffre, elle n'existe pas.
  if (!/\d/.test(normalisee)) {
    return rejeter('FORMAT_INVALIDE', 'reference', messageFormat);
  }

  const etablissement = renseigne(dto.etablissement);
  let mots: string[] | null = null;
  if (etablissement !== undefined) {
    mots = motsDeRecherche(etablissement);
    if (
      etablissement.length > ETABLISSEMENT_LONGUEUR_MAX ||
      CARACTERE_DE_CONTROLE.test(etablissement) ||
      mots.length === 0
    ) {
      return rejeter(
        'FORMAT_INVALIDE',
        'etablissement',
        "Le nom de l'établissement saisi n’est pas valide.",
      );
    }
  }

  return { canal: 'SAISIE', reference: normalisee, etablissement: mots };
}
