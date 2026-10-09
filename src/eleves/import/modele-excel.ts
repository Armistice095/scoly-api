import ExcelJS from 'exceljs';
import { COLONNES_IMPORT } from './colonnes.js';
import { NB_LIGNES_MAX, NOM_FEUILLE } from './lecture-excel.js';

/**
 * Modèle Excel téléchargeable. Feuille « Élèves » = la seule lue à l'import,
 * volontairement VIDE (aucune ligne d'exemple : elle serait importée si on
 * oubliait de la supprimer). L'exemple et la légende sont dans la feuille
 * « Instructions ».
 */
export async function genererModeleExcel(): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = 'Scoly';

  const feuille = classeur.addWorksheet(NOM_FEUILLE, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  feuille.columns = COLONNES_IMPORT.map((colonne) => ({
    header: colonne.obligatoire ? `${colonne.entete} *` : colonne.entete,
    key: colonne.cle,
    width: colonne.largeur,
    // Format « Texte » : sans ça Excel supprime le 0 initial d'un numéro
    // (0197164676 → 197164676) et transforme un matricule en nombre.
    style: {
      numFmt:
        colonne.cle === 'dateNaissance' || colonne.cle === 'dateInscription'
          ? 'dd/mm/yyyy'
          : '@',
    },
  }));

  const entete = feuille.getRow(1);
  entete.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  entete.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  entete.alignment = { vertical: 'middle' };
  entete.height = 22;

  // Liste déroulante pour le sexe.
  const indexSexe = COLONNES_IMPORT.findIndex((c) => c.cle === 'sexe') + 1;
  for (let ligne = 2; ligne <= NB_LIGNES_MAX + 1; ligne++) {
    feuille.getCell(ligne, indexSexe).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Masculin,Féminin"'],
    };
  }

  const aide = classeur.addWorksheet('Instructions');
  aide.getColumn(1).width = 100;
  [
    'Comment remplir le fichier',
    '',
    `• Une ligne par élève, dans la feuille « ${NOM_FEUILLE} », à partir de la ligne 2. Ne modifiez pas la ligne d'en-tête.`,
    '• Les colonnes marquées d’une étoile (*) sont obligatoires.',
    '• Matricule et Matricule EducMaster : facultatifs, texte libre, uniques dans l’établissement.',
    '• Sexe : Masculin ou Féminin.',
    '• Date de naissance : JJ/MM/AAAA (ex. 15/07/2014). L’élève doit avoir entre 2 et 30 ans.',
    '• Téléphone : 10 chiffres (ex. 0197164676) ou format international (+229…).',
    '• Classe (ex. CE1, 3ème A) et Date d’inscription (JJ/MM/AAAA) : facultatives, modifiables plus tard.',
    `• Maximum ${NB_LIGNES_MAX} élèves par fichier.`,
    '• Si une seule ligne est invalide, aucun élève n’est importé : corrigez le fichier puis réessayez.',
    '',
    'Exemple de ligne :',
    'CEG-0007 | EM-7300322 | ADJAHO | Nadège | Féminin | 15/07/2014 | Cotonou | M. Basile Hounkpatin | 0197164676 | Quartier Togoudo | CE1 | 22/06/2023',
  ].forEach((texte, index) => {
    const cellule = aide.getCell(index + 1, 1);
    cellule.value = texte;
    cellule.alignment = { wrapText: true, vertical: 'top' };
    if (index === 0) cellule.font = { bold: true, size: 14 };
  });

  return Buffer.from(await classeur.xlsx.writeBuffer());
}
