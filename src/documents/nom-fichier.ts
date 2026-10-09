/**
 * Nom du fichier proposé à l'enregistrement : « Certificat de scolarite - ADJAHO Nadege.pdf ».
 *
 * Le nom doit être sûr sur Windows, macOS et Android, et passer tel quel dans
 * le paramètre `download` de l'URL signée. On se limite donc à : lettres sans
 * accent, chiffres, espace, tiret, point et souligné. Tout le reste est
 * remplacé par un espace puis réduit — notamment `\ / : * ? " < > |`
 * (interdits sous Windows) et l'apostrophe (que la librairie Supabase
 * encoderait deux fois dans l'URL, laissant « %27 » dans le nom du fichier).
 *
 * Le numéro unique n'est volontairement pas utilisé : il contient des « / ».
 */

// Lettres que la décomposition Unicode ne ramène pas à l'ASCII, dont les
// lettres de l'orthographe des langues béninoises (ɛ ɔ ɖ ŋ).
const TRANSLITTERATION: Record<string, string> = {
  œ: 'oe',
  Œ: 'OE',
  æ: 'ae',
  Æ: 'AE',
  ß: 'ss',
  ø: 'o',
  Ø: 'O',
  ɛ: 'e',
  Ɛ: 'E',
  ɔ: 'o',
  Ɔ: 'O',
  ɖ: 'd',
  Ɖ: 'D',
  ŋ: 'n',
  Ŋ: 'N',
  ɣ: 'g',
  Ɣ: 'G',
  đ: 'd',
  Đ: 'D',
  ł: 'l',
  Ł: 'L',
};

const LONGUEUR_MAX = 120; // sans l'extension

function enAscii(texte: string): string {
  return texte
    .replace(/\P{ASCII}/gu, (c) => TRANSLITTERATION[c] ?? c)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function nomFichierTelechargement(
  typeDocument: string,
  nom: string,
  prenoms: string,
): string {
  const brut = `${typeDocument} - ${nom.toLocaleUpperCase('fr-FR')} ${prenoms}`;

  const propre = enAscii(brut)
    .replace(/[^A-Za-z0-9 ._-]+/g, ' ') // tout ce qui n'est pas sûr devient un espace
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LONGUEUR_MAX)
    .replace(/^[ .]+|[ .]+$/g, ''); // Windows refuse un nom finissant par un point ou un espace

  // Rien d'exploitable (ex. saisie entièrement non latine) : ne reste que « - ».
  return `${/[A-Za-z0-9]/.test(propre) ? propre : 'Document'}.pdf`;
}
