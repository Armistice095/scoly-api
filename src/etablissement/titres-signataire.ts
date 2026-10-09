/**
 * Titres proposés pour le signataire des documents (liste déroulante des
 * Paramètres). Source unique : validée à l'enregistrement, et utilisée par les
 * PDF pour accorder le texte (« Je soussigné » / « Je soussignée »).
 */
export const TITRES_SIGNATAIRE = [
  'Directeur',
  'Directrice',
  'Proviseur',
  'Proviseure',
] as const;

export type TitreSignataire = (typeof TITRES_SIGNATAIRE)[number];

/** Titre utilisé quand aucun n'est enregistré : c'est la valeur pré-sélectionnée dans les Paramètres. */
export const TITRE_PAR_DEFAUT: TitreSignataire = 'Directeur';

export interface InfosTitre {
  /** Titre tel qu'écrit dans la phrase : « Directrice ». */
  libelle: string;
  /** « Le Directeur » / « La Directrice » (signature). */
  avecArticle: string;
  /** « soussigné » / « soussignée ». */
  soussigne: string;
}

const FEMININS = new Set<string>(['Directrice', 'Proviseure']);

/**
 * Déduit les accords d'un titre. Un titre hors liste (ancienne valeur saisie
 * librement avant la liste déroulante) est repris tel quel, sans deviner le
 * genre : « Je soussigné(e) ».
 */
export function infosTitre(titre: string | null): InfosTitre {
  const libelle = titre?.trim() || TITRE_PAR_DEFAUT;
  const connu = (TITRES_SIGNATAIRE as readonly string[]).includes(libelle);

  if (!connu) {
    return { libelle, avecArticle: libelle, soussigne: 'soussigné(e)' };
  }
  const feminin = FEMININS.has(libelle);
  return {
    libelle,
    avecArticle: `${feminin ? 'La' : 'Le'} ${libelle}`,
    soussigne: feminin ? 'soussignée' : 'soussigné',
  };
}
