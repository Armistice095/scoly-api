/**
 * Normalisation pour la recherche : minuscules, sans accents, et tout ce qui
 * n'est pas une lettre ou un chiffre (tiret, apostrophe, point…) devient un
 * espace. « Nadège », « NADEGE » et « nadege » donnent la même chose, et
 * « Jean-Pierre » se retrouve en tapant « jean pierre » comme « jean-pierre ».
 */
export function normaliserPourRecherche(texte: string): string {
  return texte
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Mots à chercher : chacun doit se retrouver dans le texte de recherche de l'élève. */
export function motsDeRecherche(saisie: string): string[] {
  const normalise = normaliserPourRecherche(saisie);
  return normalise === '' ? [] : normalise.split(' ');
}

/**
 * Valeur de la colonne `recherche_normalisee`. TOUTE écriture d'un élève
 * (création, modification, import, seed) doit la recalculer avec cette
 * fonction, sinon la recherche ne le trouve plus.
 */
export function construireTexteRecherche(champs: {
  nom: string;
  prenoms: string;
  matricule?: string | null;
  matriculeEducMaster?: string | null;
  classe?: string | null;
}): string {
  return normaliserPourRecherche(
    [
      champs.nom,
      champs.prenoms,
      champs.matricule,
      champs.matriculeEducMaster,
      champs.classe,
    ]
      .filter(Boolean)
      .join(' '),
  );
}
