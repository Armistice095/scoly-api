/** Numéro international : + suivi de 8 à 15 chiffres (norme E.164). */
export const REGEX_TELEPHONE = /^\+\d{8,15}$/;

/**
 * Ramène un numéro saisi librement vers le format stocké (+229XXXXXXXXXX).
 *
 * Depuis la réforme de 2024, les numéros béninois ont 10 chiffres (ex.
 * `01 97 16 46 76`). On accepte donc :
 * - un numéro local à 10 chiffres → préfixé par +229
 * - `229…` ou `00229…` → converti en `+229…`
 * - un numéro déjà international (`+…`) → conservé (parent à l'étranger)
 *
 * Tout le reste est renvoyé nettoyé mais inchangé : c'est la validation
 * (REGEX_TELEPHONE) qui le rejettera avec un message clair, plutôt que de
 * deviner un indicatif pays.
 */
export function normaliserTelephone(valeur: string): string {
  const nettoye = valeur.replace(/[\s.\-()]/g, '');

  if (nettoye.startsWith('+')) return nettoye;
  if (nettoye.startsWith('00')) return `+${nettoye.slice(2)}`;
  if (/^229\d{10}$/.test(nettoye)) return `+${nettoye}`;
  if (/^\d{10}$/.test(nettoye)) return `+229${nettoye}`;

  return nettoye;
}
