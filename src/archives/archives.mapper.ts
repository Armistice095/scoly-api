import type { Prisma } from '@prisma/client';
import type { DonneesDocument } from '../documents/donnees-document.js';

const dateIso = (date: Date) => date.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Ce qu'on lit en base (un seul endroit pour la forme des requêtes)
// ---------------------------------------------------------------------------

/** Auteur d'une action : juste de quoi afficher « Prénom Nom (Fonction) ». */
const AUTEUR = {
  select: { id: true, nomComplet: true, fonction: true, email: true },
} satisfies Prisma.UtilisateurDefaultArgs;

/** Ligne de la liste : le strict nécessaire. */
export const POUR_LISTE = {
  select: {
    id: true,
    numeroUnique: true,
    statut: true,
    createdAt: true,
    dateEmission: true,
    eleveId: true,
    donneesFigees: true,
    typeDocument: { select: { id: true, code: true, nom: true } },
    annulation: { select: { motif: true, createdAt: true } },
  },
} satisfies Prisma.DocumentDefaultArgs;
export type DocumentPourListe = Prisma.DocumentGetPayload<typeof POUR_LISTE>;

/** Les derniers téléchargements affichés dans l'historique (le total est donné à part). */
export const HISTORIQUE_TELECHARGEMENTS_MAX = 100;

export const POUR_DETAIL = {
  select: {
    id: true,
    numeroUnique: true,
    statut: true,
    createdAt: true,
    dateEmission: true,
    eleveId: true,
    donneesFigees: true,
    typeDocument: { select: { id: true, code: true, nom: true } },
    etabliPar: AUTEUR,
    annulation: {
      select: { motif: true, createdAt: true, annulePar: AUTEUR },
    },
    telechargements: {
      orderBy: { createdAt: 'desc' },
      take: HISTORIQUE_TELECHARGEMENTS_MAX,
      select: { id: true, createdAt: true, utilisateur: AUTEUR },
    },
    _count: { select: { telechargements: true } },
  },
} satisfies Prisma.DocumentDefaultArgs;
export type DocumentPourDetail = Prisma.DocumentGetPayload<typeof POUR_DETAIL>;

// ---------------------------------------------------------------------------
// Ce qu'on renvoie au front
// ---------------------------------------------------------------------------

type AuteurBrut = {
  id: string;
  nomComplet: string | null;
  fonction: string;
  email: string;
};

/** « Mireille Ahouandjinou » + « Secrétaire » ; l'e-mail ne sert que si la personne n'a pas (encore) de nom. */
export function versAuteur(utilisateur: AuteurBrut) {
  return {
    id: utilisateur.id,
    nomComplet: utilisateur.nomComplet?.trim() || utilisateur.email,
    fonction: utilisateur.fonction,
  };
}

/** L'élève tel qu'IMPRIMÉ sur le document (jamais la fiche actuelle), « Prénoms Nom » comme à l'écran. */
export function versEleve(eleveId: string, donneesFigees: unknown) {
  const { eleve } = donneesFigees as unknown as DonneesDocument;
  return {
    id: eleveId,
    nom: eleve.nom,
    prenoms: eleve.prenoms,
    nomComplet: `${eleve.prenoms} ${eleve.nom}`.trim(),
    matricule: eleve.matricule,
    matriculeEducMaster: eleve.matriculeEducMaster,
  };
}

export function versLigne(document: DocumentPourListe) {
  const { id, nomComplet } = versEleve(
    document.eleveId,
    document.donneesFigees,
  );
  return {
    id: document.id,
    reference: document.numeroUnique,
    statut: document.statut,
    createdAt: document.createdAt,
    dateEmission: dateIso(document.dateEmission),
    typeDocument: document.typeDocument,
    eleve: { id, nomComplet },
    // Pour l'indication « Motif : … » sous le badge « Annulé ».
    annulation: document.annulation
      ? { motif: document.annulation.motif, le: document.annulation.createdAt }
      : null,
    telechargeable: document.statut === 'ACTIF',
  };
}

export type TypeEvenement = 'ETABLI' | 'TELECHARGE' | 'ANNULE';

export interface Evenement {
  type: TypeEvenement;
  le: Date;
  par: ReturnType<typeof versAuteur>;
}

/**
 * Historique complet, du plus récent au plus ancien. Composé à partir des
 * trois sources de vérité (le document, le journal de téléchargements,
 * l'annulation) : rien n'est dupliqué dans une table « événements ».
 */
export function construireHistorique(
  document: DocumentPourDetail,
): Evenement[] {
  const evenements: Evenement[] = [
    {
      type: 'ETABLI',
      le: document.createdAt,
      par: versAuteur(document.etabliPar),
    },
    ...document.telechargements.map((t) => ({
      type: 'TELECHARGE' as const,
      le: t.createdAt,
      par: versAuteur(t.utilisateur),
    })),
  ];
  if (document.annulation) {
    evenements.push({
      type: 'ANNULE',
      le: document.annulation.createdAt,
      par: versAuteur(document.annulation.annulePar),
    });
  }
  // Tri stable : à égalité d'instant, l'annulation passe avant le téléchargement
  // et l'établissement vient toujours en dernier.
  const rang: Record<TypeEvenement, number> = {
    ANNULE: 0,
    TELECHARGE: 1,
    ETABLI: 2,
  };
  return evenements.sort(
    (a, b) => b.le.getTime() - a.le.getTime() || rang[a.type] - rang[b.type],
  );
}

export function versDetail(document: DocumentPourDetail) {
  return {
    id: document.id,
    reference: document.numeroUnique,
    statut: document.statut,
    createdAt: document.createdAt,
    dateEmission: dateIso(document.dateEmission),
    typeDocument: document.typeDocument,
    eleve: versEleve(document.eleveId, document.donneesFigees),
    etabli: { par: versAuteur(document.etabliPar), le: document.createdAt },
    annulation: document.annulation
      ? {
          par: versAuteur(document.annulation.annulePar),
          le: document.annulation.createdAt,
          motif: document.annulation.motif,
        }
      : null,
    historique: construireHistorique(document),
    nombreTelechargements: document._count.telechargements,
    telechargeable: document.statut === 'ACTIF',
  };
}
