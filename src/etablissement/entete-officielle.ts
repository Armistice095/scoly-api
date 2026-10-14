import type { OrdreEnseignement } from '@prisma/client';

/**
 * Règles de l'en-tête officiel des documents (ministère de tutelle, direction
 * départementale, devise). SOURCE UNIQUE : le front ne recalcule rien, il
 * interroge `GET /etablissement/entete-par-defaut` (même fonction que celle
 * utilisée à l'inscription et à la mise à jour de l'établissement).
 */

export const DEVISE_OFFICIELLE = 'Fraternité - Justice - Travail';

export type CodeMinistere = 'MEMP' | 'MESTFP';

interface Ministere {
  /** Intitulé complet, sigle compris : imprimé tel quel sur les documents. */
  libelle: string;
  /** Début de l'intitulé de la direction départementale, avant « du/de … ». */
  libelleDirection: string;
  /** Préfixe du sigle de la direction : « DDEMP » → « DDEMP-MONO ». */
  prefixeSigleDirection: string;
}

export const MINISTERES: Record<CodeMinistere, Ministere> = {
  MEMP: {
    libelle: 'Ministère des Enseignements Maternel et Primaire (MEMP)',
    libelleDirection:
      'Direction Départementale des Enseignements Maternel et Primaire',
    prefixeSigleDirection: 'DDEMP',
  },
  MESTFP: {
    libelle:
      'Ministère des Enseignements Secondaires, Technique et de la Formation Professionnelle (MESTFP)',
    libelleDirection:
      'Direction Départementale des Enseignements Secondaires, Technique et de la Formation Professionnelle',
    prefixeSigleDirection: 'DDESTFP',
  },
};

/**
 * Correspondance exhaustive avec l'enum Prisma `OrdreEnseignement` : si une
 * valeur est ajoutée à l'enum, ce `satisfies` ne compile plus tant qu'elle
 * n'est pas rattachée à un ministère (pas de deviner).
 *
 * SECONDAIRE couvre le général ET le technique/professionnel : l'enum ne les
 * distingue pas, et les deux relèvent du MESTFP.
 */
export const MINISTERE_PAR_ORDRE = {
  MATERNELLE: 'MEMP',
  PRIMAIRE: 'MEMP',
  SECONDAIRE: 'MESTFP',
} as const satisfies Record<OrdreEnseignement, CodeMinistere>;

interface DepartementOfficiel {
  nom: string;
  /** Nom précédé de sa préposition : « du Mono », « de l’Atlantique », « de la Donga », « des Collines ». */
  avecPreposition: string;
  /** Forme en majuscules utilisée dans le sigle (accents conservés). */
  sigle: string;
}

/** Table explicite des 12 départements du Bénin (pas de règle devinée). */
export const DEPARTEMENTS_OFFICIELS: readonly DepartementOfficiel[] = [
  { nom: 'Alibori', avecPreposition: 'de l’Alibori', sigle: 'ALIBORI' },
  { nom: 'Atacora', avecPreposition: 'de l’Atacora', sigle: 'ATACORA' },
  {
    nom: 'Atlantique',
    avecPreposition: 'de l’Atlantique',
    sigle: 'ATLANTIQUE',
  },
  { nom: 'Borgou', avecPreposition: 'du Borgou', sigle: 'BORGOU' },
  { nom: 'Collines', avecPreposition: 'des Collines', sigle: 'COLLINES' },
  { nom: 'Couffo', avecPreposition: 'du Couffo', sigle: 'COUFFO' },
  { nom: 'Donga', avecPreposition: 'de la Donga', sigle: 'DONGA' },
  { nom: 'Littoral', avecPreposition: 'du Littoral', sigle: 'LITTORAL' },
  { nom: 'Mono', avecPreposition: 'du Mono', sigle: 'MONO' },
  { nom: 'Ouémé', avecPreposition: 'de l’Ouémé', sigle: 'OUÉMÉ' },
  { nom: 'Plateau', avecPreposition: 'du Plateau', sigle: 'PLATEAU' },
  { nom: 'Zou', avecPreposition: 'du Zou', sigle: 'ZOU' },
];

/** Minuscules, sans accents ni espaces superflus : « OUEME » et « ouémé » → « oueme ». */
function cle(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

const DEPARTEMENT_PAR_CLE = new Map(
  DEPARTEMENTS_OFFICIELS.map((d) => [cle(d.nom), d]),
);

export interface EnteteOfficielle {
  ministereTutelle: string | null;
  directionDepartementale: string | null;
  devise: string;
}

export const CHAMPS_ENTETE = [
  'ministereTutelle',
  'directionDepartementale',
  'devise',
] as const;
export type ChampEntete = (typeof CHAMPS_ENTETE)[number];

/**
 * Valeurs par défaut de l'en-tête. Un ordre ou un département absent/inconnu
 * donne `null` pour les champs qui en dépendent (jamais de valeur devinée) ;
 * la devise, fixe, est toujours fournie.
 */
export function enteteParDefaut(
  ordreEnseignement: OrdreEnseignement | null | undefined,
  departement: string | null | undefined,
): EnteteOfficielle {
  const code = ordreEnseignement
    ? (MINISTERE_PAR_ORDRE as Record<string, CodeMinistere | undefined>)[
        ordreEnseignement
      ]
    : undefined;
  const ministere = code ? MINISTERES[code] : undefined;
  const dept = departement
    ? DEPARTEMENT_PAR_CLE.get(cle(departement))
    : undefined;

  return {
    ministereTutelle: ministere?.libelle ?? null,
    directionDepartementale:
      ministere && dept
        ? `${ministere.libelleDirection} ${dept.avecPreposition} (${ministere.prefixeSigleDirection}-${dept.sigle})`
        : null,
    devise: DEVISE_OFFICIELLE,
  };
}

interface EtatEtablissement {
  ordreEnseignement: OrdreEnseignement;
  departement: string;
  ministereTutelle: string | null;
  directionDepartementale: string | null;
  devise: string | null;
}

interface ModificationEtablissement {
  ordreEnseignement?: OrdreEnseignement;
  departement?: string;
  ministereTutelle?: string;
  directionDepartementale?: string;
  devise?: string;
}

const estVide = (valeur: string | null | undefined) => !valeur?.trim();

/**
 * Quand l'ordre ou le département change, recale les champs d'en-tête restés
 * « automatiques » (vides, ou égaux à l'ancienne valeur par défaut).
 *
 * - Un champ envoyé explicitement dans la même requête est respecté tel quel.
 * - Un champ personnalisé (différent de l'ancien défaut) n'est JAMAIS écrasé.
 * - Rien ne change si ni l'ordre ni le département ne change.
 *
 * Renvoie uniquement les champs à ajouter à la mise à jour.
 */
export function recalerEntete(
  actuel: EtatEtablissement,
  modification: ModificationEtablissement,
): Partial<Record<ChampEntete, string>> {
  const ordre = modification.ordreEnseignement ?? actuel.ordreEnseignement;
  const departement = modification.departement ?? actuel.departement;
  if (
    ordre === actuel.ordreEnseignement &&
    departement === actuel.departement
  ) {
    return {};
  }

  const ancien = enteteParDefaut(actuel.ordreEnseignement, actuel.departement);
  const nouveau = enteteParDefaut(ordre, departement);
  const ajouts: Partial<Record<ChampEntete, string>> = {};

  for (const champ of CHAMPS_ENTETE) {
    if (modification[champ] !== undefined) continue;
    const valeurNouvelle = nouveau[champ];
    if (valeurNouvelle === null) continue;
    const valeurActuelle = actuel[champ];
    if (estVide(valeurActuelle) || valeurActuelle === ancien[champ]) {
      ajouts[champ] = valeurNouvelle;
    }
  }
  return ajouts;
}
