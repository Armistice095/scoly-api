import type { Eleve } from '@prisma/client';
import type { CreerEleveDto } from './dto/creer-eleve.dto.js';
import { construireTexteRecherche } from './utils/recherche.js';

/** Convertit une date civile AAAA-MM-JJ (déjà validée) en Date UTC minuit. */
export function dateDepuisTexte(valeur: string): Date {
  return new Date(`${valeur}T00:00:00.000Z`);
}

/** Forme renvoyée au front pour un élève. La date de naissance sort en AAAA-MM-JJ (pas d'heure, pas de fuseau). */
export function versReponse(eleve: Eleve) {
  return {
    id: eleve.id,
    matricule: eleve.matricule,
    matriculeEducMaster: eleve.matriculeEducMaster,
    nom: eleve.nom,
    prenoms: eleve.prenoms,
    sexe: eleve.sexe,
    dateNaissance: eleve.dateNaissance.toISOString().slice(0, 10),
    lieuNaissance: eleve.lieuNaissance,
    parentTuteur: eleve.parentTuteur,
    telephone: eleve.telephone,
    adresse: eleve.adresse,
    classe: eleve.classe,
    dateInscription: eleve.dateInscription
      ? eleve.dateInscription.toISOString().slice(0, 10)
      : null,
    statut: eleve.statut,
    createdAt: eleve.createdAt,
    updatedAt: eleve.updatedAt,
  };
}

/** Données d'insertion à partir d'un DTO validé. Le statut reste celui par défaut (ACTIF), jamais choisi par le client. */
export function versDonneesCreation(
  etablissementId: string,
  dto: CreerEleveDto,
) {
  return {
    etablissementId,
    matricule: dto.matricule ?? null,
    matriculeEducMaster: dto.matriculeEducMaster ?? null,
    nom: dto.nom,
    prenoms: dto.prenoms,
    sexe: dto.sexe,
    dateNaissance: dateDepuisTexte(dto.dateNaissance),
    lieuNaissance: dto.lieuNaissance,
    parentTuteur: dto.parentTuteur,
    telephone: dto.telephone,
    adresse: dto.adresse ?? null,
    classe: dto.classe ?? null,
    dateInscription: dto.dateInscription
      ? dateDepuisTexte(dto.dateInscription)
      : null,
    rechercheNormalisee: construireTexteRecherche(dto),
  };
}

/** Prisma lève P2002 sur violation d'unicité. Vérifié par le code plutôt que par instanceof : indépendant de la version du client généré. */
export function estErreurUnicite(erreur: unknown): boolean {
  return (
    typeof erreur === 'object' &&
    erreur !== null &&
    'code' in erreur &&
    (erreur as { code: unknown }).code === 'P2002'
  );
}
