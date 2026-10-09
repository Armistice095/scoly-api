/**
 * « de l'École … », « du Collège … », « de la Maternelle … » : accorde la
 * préposition avec le nom de l'établissement, saisi librement dans les
 * Paramètres. Quand le nom ne permet pas de deviner son genre (« Arche du
 * Millénium »), on contourne avec « de l'établissement … » plutôt que de
 * risquer une faute (« du Arche »).
 */
const MASCULINS = new Set([
  'college',
  'lycee',
  'complexe',
  'groupe',
  'cours',
  'centre',
  'ceg',
  'cec',
  'cpeg',
  'cem',
  'cs',
]);
const FEMININS = new Set([
  'maternelle',
  'creche',
  'garderie',
  'cite',
  'institution',
  'fondation',
]);

const sansAccent = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function deEtablissement(nom: string): string {
  const propre = nom.trim().replace(/\s+/g, ' ');
  const premierMot = propre.split(' ')[0] ?? '';
  const cle = sansAccent(premierMot);

  // Article déjà présent dans le nom : « Le Collège X » → « du Collège X ».
  if (/^le$/.test(cle) && propre.includes(' ')) return `du ${propre.slice(3)}`;
  if (/^la$/.test(cle) && propre.includes(' '))
    return `de la ${propre.slice(3)}`;
  if (/^les$/.test(cle) && propre.includes(' '))
    return `des ${propre.slice(4)}`;
  if (/^l['’]/i.test(propre)) return `de ${propre}`;

  // Voyelle ou h muet : élision (« de l'École », « de l'EPP », « de l'Institut »).
  if (/^[aeiouyh]/.test(cle)) return `de l’${propre}`;

  if (MASCULINS.has(cle)) return `du ${propre}`;
  if (FEMININS.has(cle)) return `de la ${propre}`;

  return `de l’établissement ${propre}`;
}
