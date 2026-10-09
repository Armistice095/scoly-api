import type { DonneesDocument, ImagesDocument } from '../donnees-document.js';

export type TypeChamp = 'select' | 'text' | 'textarea' | 'date';

/** Champ à saisir à chaque génération d'un type de document (décrit au front par GET /types-documents). */
export interface ChampDefinition {
  cle: string;
  libelle: string;
  type: TypeChamp;
  obligatoire: boolean;
  options?: readonly string[];
  maxLength?: number;
  placeholder?: string;
  /**
   * Champ qui vit aussi sur la fiche élève (« classe », « dateInscription ») :
   * le front le pré-remplit avec la valeur de l'élève, et la valeur saisie à la
   * génération est mémorisée sur l'élève.
   */
  eleveChamp?: 'classe' | 'dateInscription';
}

/** Contexte donné aux règles de validation propres à un champ. */
export interface ContexteValidation {
  eleve: { dateNaissance: string };
}

export interface TypeDocumentDefinition {
  code: string;
  champs: readonly ChampDefinition[];
  /** Règle supplémentaire sur un champ (ex. cohérence de dates). Renvoie un message d'erreur ou null. */
  validerChamp?: (
    champ: ChampDefinition,
    valeur: string,
    contexte: ContexteValidation,
  ) => string | null;
  /** Rendu du PDF (PDFKit). */
  rendre: (donnees: DonneesDocument, images: ImagesDocument) => Promise<Buffer>;
  /** Préfixe du nom de fichier téléchargé (« certificat » → certificat_NOM_Prenoms_….pdf). */
  prefixeFichier: string;
}
