/**
 * Clé de comparaison d'une référence de document (« N°0042/2025-2026/CEG-GODOMEY »).
 *
 * Utilisée des DEUX côtés — à l'émission (colonne `documents.reference_normalisee`)
 * et à la saisie du vérificateur — donc toute sur-normalisation est symétrique :
 * elle ne peut pas faire rater un document, seulement (très rarement) en
 * rapprocher deux, ce que la page de vérification sait gérer (résultat AMBIGU).
 *
 * Ce qui est toléré à la saisie :
 *  - la casse et les accents ;
 *  - les variantes du « N° » : `N°`, `n°`, `N °`, `Nº`, `N˚`, `No`, `N.`, `№`,
 *    `Num`, `Numéro`… ou son absence ;
 *  - la ponctuation et les espaces (`/`, `-`, `.`, `_`, espaces multiples…) ;
 *  - les zéros initiaux d'un nombre (`0042` = `42`).
 *
 * « N°0042/2025-2026/CEG-GODOMEY » → « 42 2025 2026 ceg godomey »
 */

/** Mots qui introduisent le numéro (déjà sans accent ni ponctuation). */
const MOTS_NUMERO = new Set(['n', 'no', 'nr', 'num', 'numero']);

export function normaliserReference(texte: string): string {
  const jetons = texte
    // NFKC ramène `№` → `No`, `º` → `o`, les chiffres pleine largeur → ASCII…
    .normalize('NFKC')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    // Tout ce qui n'est pas [a-z0-9] (dont `°`, `˚`, `/`, `-`) sépare deux jetons.
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((jeton) => jeton !== '');

  // Préfixe « N° » : `n 42` / `no 42` / `numero 42`, ou collé : `n42` / `no42`.
  // Jamais retiré s'il est le seul jeton (rien ne resterait à comparer).
  const premier = jetons[0];
  if (premier !== undefined && jetons.length > 1 && MOTS_NUMERO.has(premier)) {
    jetons.shift();
  } else if (premier !== undefined && /^(?:no|n)\d/.test(premier)) {
    jetons[0] = premier.replace(/^(?:no|n)/, '');
  }

  // Zéros initiaux des nombres purs (« 0042 » → « 42 », « 000 » → « 0 »).
  return jetons
    .map((jeton) =>
      /^\d+$/.test(jeton) ? jeton.replace(/^0+(?=\d)/, '') : jeton,
    )
    .join(' ');
}
