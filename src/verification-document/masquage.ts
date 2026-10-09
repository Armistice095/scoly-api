/**
 * Nom d'élève affiché publiquement : premier prénom + initiale du nom
 * (« Adjovi Akpovi » → « Adjovi A. »). Suffisant pour qu'un employeur
 * recoupe avec le document qu'il a en main, insuffisant pour identifier un
 * mineur à partir de l'écran seul.
 */
export function masquerNomEleve(nom: string, prenoms: string): string {
  const premierPrenom = prenoms.trim().split(/\s+/)[0] ?? '';
  // Array.from : un caractère hors plan de base ne doit pas être coupé en deux.
  const initiale = Array.from(nom.trim())[0]?.toLocaleUpperCase('fr-FR');
  return [premierPrenom, initiale ? `${initiale}.` : '']
    .filter((morceau) => morceau !== '')
    .join(' ');
}
