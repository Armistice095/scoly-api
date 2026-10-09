import type { TransformFnParams } from 'class-transformer';

/** Retire les espaces en début/fin des chaînes ; laisse toute autre valeur intacte (la validation s'en chargera). */
export function nettoyerTexte({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Comme nettoyerTexte, mais une chaîne vide devient `null` : pour un champ
 * facultatif, « vide » signifie « pas de valeur ». Indispensable pour les
 * matricules, sinon deux élèves sans matricule saisi (`''`) entreraient en
 * conflit sur la contrainte d'unicité.
 */
export function nettoyerTexteOptionnel({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const texte = value.trim();
  return texte === '' ? null : texte;
}
