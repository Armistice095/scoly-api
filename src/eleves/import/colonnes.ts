export type CleColonne =
  | 'matricule'
  | 'matriculeEducMaster'
  | 'nom'
  | 'prenoms'
  | 'sexe'
  | 'dateNaissance'
  | 'lieuNaissance'
  | 'parentTuteur'
  | 'telephone'
  | 'adresse'
  | 'classe'
  | 'dateInscription';

export interface ColonneImport {
  cle: CleColonne;
  /** Libellé affiché dans le modèle Excel. */
  entete: string;
  obligatoire: boolean;
  largeur: number;
  /** Autres intitulés acceptés à la lecture (comparés après normalisation). */
  alias?: string[];
}

/** Ordre = ordre des colonnes du modèle téléchargeable. */
export const COLONNES_IMPORT: readonly ColonneImport[] = [
  { cle: 'matricule', entete: 'Matricule', obligatoire: false, largeur: 16 },
  {
    cle: 'matriculeEducMaster',
    entete: 'Matricule EducMaster',
    obligatoire: false,
    largeur: 22,
  },
  { cle: 'nom', entete: 'Nom', obligatoire: true, largeur: 22 },
  {
    cle: 'prenoms',
    entete: 'Prénoms',
    obligatoire: true,
    largeur: 24,
    alias: ['prenom'],
  },
  { cle: 'sexe', entete: 'Sexe', obligatoire: true, largeur: 12 },
  {
    cle: 'dateNaissance',
    entete: 'Date de naissance',
    obligatoire: true,
    largeur: 18,
  },
  {
    cle: 'lieuNaissance',
    entete: 'Lieu de naissance',
    obligatoire: true,
    largeur: 22,
  },
  {
    cle: 'parentTuteur',
    entete: 'Parent ou tuteur',
    obligatoire: true,
    largeur: 26,
    alias: ['parent', 'tuteur'],
  },
  {
    cle: 'telephone',
    entete: 'Téléphone',
    obligatoire: true,
    largeur: 18,
    alias: ['tel', 'telephoneparent'],
  },
  { cle: 'adresse', entete: 'Adresse', obligatoire: false, largeur: 30 },
  { cle: 'classe', entete: 'Classe', obligatoire: false, largeur: 14 },
  {
    cle: 'dateInscription',
    entete: "Date d'inscription",
    obligatoire: false,
    largeur: 20,
    alias: ['inscritdepuis'],
  },
];

/** « Prénoms * », « prenoms », « PRÉNOMS » → « prenoms ». */
export function normaliserEntete(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Normalisation d'une valeur textuelle pour comparer des noms : insensible à la casse, aux accents et aux espaces multiples. */
export function normaliserTexte(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function trouverColonne(entete: string): ColonneImport | undefined {
  const cle = normaliserEntete(entete);
  return COLONNES_IMPORT.find(
    (colonne) =>
      normaliserEntete(colonne.entete) === cle || colonne.alias?.includes(cle),
  );
}
