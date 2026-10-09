import { normaliserPourRecherche } from '../eleves/utils/recherche.js';

/**
 * Valeur de la colonne `documents.recherche_normalisee`, utilisée par la
 * recherche des Archives (« adjovi », « 0024 », « n°24/2025 »…).
 *
 * Construite à partir de ce qui est IMPRIMÉ sur le document (référence et
 * identité figée de l'élève), pas de la fiche élève actuelle : corriger un
 * nom plus tard ne change ni le PDF ni la façon dont on le retrouve.
 * Calculée une seule fois, à l'émission (le document ne change plus ensuite).
 */
export function construireTexteRechercheDocument(
  numero: string,
  eleve: {
    nom: string;
    prenoms: string;
    matricule?: string | null;
    matriculeEducMaster?: string | null;
  },
): string {
  return normaliserPourRecherche(
    [
      numero,
      eleve.nom,
      eleve.prenoms,
      eleve.matricule,
      eleve.matriculeEducMaster,
    ]
      .filter(Boolean)
      .join(' '),
  );
}
