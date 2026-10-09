import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Noto Serif (licence OFL, voir fonts/OFL-NotoSerif.txt), embarquée avec le
 * code : le rendu est identique sur toute machine, accents et lettres
 * béninoises (ɛ ɔ ɖ ŋ…) compris — les polices standard PDF ne les couvrent pas.
 * Les fichiers sont lus une seule fois puis gardés en mémoire.
 */
const FICHIERS = {
  Serif: 'NotoSerif-Regular.ttf',
  'Serif-Bold': 'NotoSerif-Bold.ttf',
  'Serif-Italic': 'NotoSerif-Italic.ttf',
  'Serif-BoldItalic': 'NotoSerif-BoldItalic.ttf',
} as const;

export type NomPolice = keyof typeof FICHIERS;

const cache = new Map<NomPolice, Buffer>();

function lirePolice(nom: NomPolice): Buffer {
  let contenu = cache.get(nom);
  if (!contenu) {
    contenu = readFileSync(
      fileURLToPath(new URL(`./fonts/${FICHIERS[nom]}`, import.meta.url)),
    );
    cache.set(nom, contenu);
  }
  return contenu;
}

export function enregistrerPolices(doc: PDFKit.PDFDocument): void {
  for (const nom of Object.keys(FICHIERS) as NomPolice[]) {
    doc.registerFont(nom, lirePolice(nom));
  }
}
