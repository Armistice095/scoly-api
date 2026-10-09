/**
 * Tout ce dont un modèle PDF a besoin, et rien de plus. C'est aussi ce qu'on
 * fige dans `Document.donneesFigees` à l'émission : le PDF est rendu à partir
 * de cette photographie, jamais des tables « vivantes ».
 */
export interface DonneesDocument {
  etablissement: {
    nom: string;
    ministereTutelle: string | null;
    directionDepartementale: string | null;
    devise: string | null;
    adresse: string | null;
    telephone: string | null;
    email: string | null;
    nomSignataire: string | null;
    /** Titre choisi dans les Paramètres : Directeur, Directrice, Proviseur ou Proviseure. */
    fonctionSignataire: string | null;
    /** Lieu de « Fait à … ». */
    lieu: string;
  };
  anneeScolaire: string | null;
  eleve: {
    nom: string;
    prenoms: string;
    sexe: 'MASCULIN' | 'FEMININ';
    /** AAAA-MM-JJ */
    dateNaissance: string;
    lieuNaissance: string;
    matricule: string | null;
    matriculeEducMaster: string | null;
  };
  /** Champs saisis, déjà validés et nettoyés (cf. validation-champs.ts). */
  champs: Record<string, string>;
  numero: string;
  /** AAAA-MM-JJ */
  dateEmission: string;
  /** URL encodée dans le QR code ; `null` pour un aperçu. */
  urlVerification: string | null;
  apercu: boolean;
}

/** Images de l'établissement (octets PNG/JPEG), chargées depuis le stockage. Toutes facultatives. */
export interface ImagesDocument {
  logo?: Buffer;
  signature?: Buffer;
  cachet?: Buffer;
}
