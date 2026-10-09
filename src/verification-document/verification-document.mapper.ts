import type { Prisma } from '@prisma/client';
import { dateCivileDuJour } from '../documents/dates.js';
import type { DonneesDocument } from '../documents/donnees-document.js';
import { normaliserPourRecherche } from '../eleves/utils/recherche.js';
import { PAYS, type Resultat } from './constantes.js';
import { masquerNomEleve } from './masquage.js';

// ---------------------------------------------------------------------------
// Ce qu'on lit en base. LISTE BLANCHE : tout champ absent d'ici ne peut pas
// sortir par erreur (annulation.motif, annulePar, etabliPar, eleveId, matricule
// de la colonne, urlPdf, qrCodeToken, champsSaisis… ne sont jamais sélectionnés).
// ---------------------------------------------------------------------------

export const POUR_VERIFICATION = {
  select: {
    id: true,
    numeroUnique: true,
    statut: true,
    dateEmission: true,
    // Photographie de ce qui est imprimé. Seuls eleve.nom, eleve.prenoms et
    // etablissement.nom en sont extraits ci-dessous (Prisma ne sait pas
    // sélectionner un sous-champ JSON) ; le reste (date de naissance,
    // matricules…) est lu en mémoire mais ne quitte jamais ce fichier.
    donneesFigees: true,
    typeDocument: { select: { nom: true } },
    // Coordonnées ACTUELLES de l'école : un numéro changé depuis l'émission
    // doit être le bon, pas l'ancien.
    etablissement: {
      select: {
        nom: true,
        commune: true,
        departement: true,
        telephone: true,
        email: true,
      },
    },
    // Uniquement la date : jamais le motif ni l'auteur.
    annulation: { select: { createdAt: true } },
  },
} satisfies Prisma.DocumentDefaultArgs;
export type DocumentPourVerification = Prisma.DocumentGetPayload<
  typeof POUR_VERIFICATION
>;

// ---------------------------------------------------------------------------
// Ce qu'on renvoie
// ---------------------------------------------------------------------------

export interface ReponseVerification {
  resultat: Resultat;
  /** Heure du SERVEUR, ISO 8601 UTC (à afficher en Africa/Porto-Novo). */
  verifieLe: string;
  document: {
    typeDocument: string;
    reference: string;
    /** « Adjovi A. » */
    eleve: string;
    /** AAAA-MM-JJ */
    dateEmission: string;
    /** AAAA-MM-JJ (Africa/Porto-Novo) ; `null` si le document n'est pas annulé. */
    dateAnnulation: string | null;
  } | null;
  etablissement: {
    nom: string;
    /** « Abomey-Calavi, Atlantique » */
    localite: string;
    pays: string;
    telephone: string | null;
    email: string | null;
  } | null;
}

const dateIso = (date: Date) => date.toISOString().slice(0, 10);

/** Réponse sans aucun détail : INTROUVABLE et AMBIGU ont strictement la même forme. */
export function reponseSansDocument(
  resultat: 'INTROUVABLE' | 'AMBIGU',
  verifieLe: Date,
): ReponseVerification {
  return {
    resultat,
    verifieLe: verifieLe.toISOString(),
    document: null,
    etablissement: null,
  };
}

export function reponseAvecDocument(
  document: DocumentPourVerification,
  verifieLe: Date,
): ReponseVerification {
  const figees = document.donneesFigees as unknown as DonneesDocument;
  const { etablissement } = document;
  const annule = document.statut === 'ANNULE';

  return {
    resultat: annule ? 'ANNULE' : 'VALIDE',
    verifieLe: verifieLe.toISOString(),
    document: {
      typeDocument: document.typeDocument.nom,
      reference: document.numeroUnique,
      eleve: masquerNomEleve(figees.eleve.nom, figees.eleve.prenoms),
      dateEmission: dateIso(document.dateEmission),
      dateAnnulation: document.annulation
        ? dateCivileDuJour(document.annulation.createdAt)
        : null,
    },
    etablissement: {
      // Le nom tel qu'IMPRIMÉ sur le document (renommer l'école plus tard ne
      // contredit pas le PDF) ; à défaut, le nom actuel.
      nom: figees.etablissement?.nom?.trim() || etablissement.nom,
      localite: [etablissement.commune, etablissement.departement]
        .map((morceau) => morceau.trim())
        .filter((morceau) => morceau !== '')
        .join(', '),
      pays: PAYS,
      telephone: etablissement.telephone?.trim() || null,
      email: etablissement.email?.trim() || null,
    },
  };
}

/**
 * Le nom d'établissement donné par le vérificateur (mots normalisés) désigne-t-il
 * ce document ? Chaque mot doit se retrouver dans le nom imprimé OU actuel.
 */
export function correspondEtablissement(
  document: DocumentPourVerification,
  mots: string[],
): boolean {
  const figees = document.donneesFigees as unknown as DonneesDocument;
  const noms = normaliserPourRecherche(
    `${figees.etablissement?.nom ?? ''} ${document.etablissement.nom}`,
  );
  return mots.every((mot) => noms.includes(mot));
}
