import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  COLONNES_IMPORT,
  normaliserTexte,
  trouverColonne,
  type CleColonne,
} from './colonnes.js';

export const NB_LIGNES_MAX = 500;
export const NOM_FEUILLE = 'Élèves';

export interface LigneImport {
  /** Numéro de ligne dans Excel (l'en-tête est la ligne 1), pour les messages d'erreur. */
  ligne: number;
  valeurs: Partial<Record<CleColonne, string>>;
}

function erreurFichier(code: string, message: string) {
  return new BadRequestException({ message, code });
}

/** Un fichier .xlsx est une archive ZIP : signature « PK ». Évite de confier n'importe quel contenu à l'analyseur. */
function ressembleAUnZip(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function versTexte(valeur: ExcelJS.CellValue): string {
  if (valeur === null || valeur === undefined) return '';
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10);
  if (typeof valeur === 'string') return valeur.trim();
  if (typeof valeur === 'number' || typeof valeur === 'boolean') {
    return String(valeur);
  }
  if ('richText' in valeur) {
    return valeur.richText
      .map((morceau) => morceau.text)
      .join('')
      .trim();
  }
  if ('result' in valeur) return versTexte(valeur.result as ExcelJS.CellValue);
  if ('text' in valeur) return String(valeur.text).trim(); // lien hypertexte
  return '';
}

/** JJ/MM/AAAA (saisie texte) → AAAA-MM-JJ ; le reste est laissé tel quel pour que la validation le signale. */
function normaliserDate(texte: string): string {
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texte);
  if (!fr) return texte;
  return `${fr[3]}-${fr[2]!.padStart(2, '0')}-${fr[1]!.padStart(2, '0')}`;
}

const SEXES: Record<string, 'MASCULIN' | 'FEMININ'> = {
  m: 'MASCULIN',
  masculin: 'MASCULIN',
  garcon: 'MASCULIN',
  homme: 'MASCULIN',
  f: 'FEMININ',
  feminin: 'FEMININ',
  fille: 'FEMININ',
  femme: 'FEMININ',
};

function normaliserSexe(texte: string): string {
  return SEXES[normaliserTexte(texte)] ?? texte;
}

/**
 * Lit la première feuille (ou celle nommée « Élèves ») d'un fichier .xlsx et
 * renvoie les lignes de données sous forme de texte brut. La validation
 * métier n'est PAS faite ici : elle passe par CreerEleveDto, comme la
 * création unitaire.
 */
export async function lireFichierExcel(buffer: Buffer): Promise<LigneImport[]> {
  if (!ressembleAUnZip(buffer)) {
    throw erreurFichier(
      'FICHIER_INVALIDE',
      "Le fichier n'est pas un classeur Excel (.xlsx) valide.",
    );
  }

  const classeur = new ExcelJS.Workbook();
  try {
    await classeur.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw erreurFichier(
      'FICHIER_INVALIDE',
      "Impossible de lire le fichier : il est corrompu ou n'est pas un fichier Excel (.xlsx).",
    );
  }

  const feuille =
    classeur.getWorksheet(NOM_FEUILLE) ?? classeur.worksheets[0] ?? undefined;
  if (!feuille) {
    throw erreurFichier(
      'FICHIER_VIDE',
      'Le fichier ne contient aucune feuille.',
    );
  }

  // --- En-têtes (ligne 1) : colonne Excel → clé métier ---
  const colonnesParIndex = new Map<number, CleColonne>();
  feuille.getRow(1).eachCell((cellule, index) => {
    const colonne = trouverColonne(versTexte(cellule.value));
    if (colonne) colonnesParIndex.set(index, colonne.cle);
  });

  const presentes = new Set(colonnesParIndex.values());
  const manquantes = COLONNES_IMPORT.filter(
    (colonne) => colonne.obligatoire && !presentes.has(colonne.cle),
  ).map((colonne) => colonne.entete);
  if (manquantes.length > 0) {
    throw erreurFichier(
      'COLONNES_MANQUANTES',
      `Colonnes obligatoires absentes : ${manquantes.join(', ')}. Utilisez le modèle fourni.`,
    );
  }

  // --- Lignes de données ---
  const lignes: LigneImport[] = [];
  feuille.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;

    const valeurs: Partial<Record<CleColonne, string>> = {};
    let vide = true;
    for (const [index, cle] of colonnesParIndex) {
      let texte = versTexte(row.getCell(index).value);
      if (texte !== '') vide = false;
      if (cle === 'dateNaissance' || cle === 'dateInscription') {
        texte = normaliserDate(texte);
      }
      if (cle === 'sexe') texte = normaliserSexe(texte);
      valeurs[cle] = texte;
    }
    if (!vide) lignes.push({ ligne: numero, valeurs });
  });

  if (lignes.length === 0) {
    throw erreurFichier(
      'FICHIER_VIDE',
      "Le fichier ne contient aucun élève à importer (aucune ligne sous l'en-tête).",
    );
  }
  if (lignes.length > NB_LIGNES_MAX) {
    throw erreurFichier(
      'TROP_DE_LIGNES',
      `Le fichier contient ${lignes.length} lignes ; le maximum est de ${NB_LIGNES_MAX} par import. Découpez-le en plusieurs fichiers.`,
    );
  }

  return lignes;
}
