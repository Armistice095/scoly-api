import { verifierDateInscription } from '../../eleves/validators/est-date-inscription.validator.js';
import { rendreCertificatScolarite } from '../pdf/certificat-scolarite.renderer.js';
import type { TypeDocumentDefinition } from './definitions.js';

// Échelles d'appréciation (référence : SPEC.md §6). Source unique : le front
// les lit via GET /types-documents, il ne les recopie pas.
const APPRECIATIONS_ASSIDUITE_CONDUITE = [
  'Excellente',
  'Bonne',
  'Moyenne',
  'Insuffisante',
] as const;
const APPRECIATIONS_TRAVAIL = [
  'Excellent',
  'Satisfaisant',
  'Moyen',
  'Insuffisant',
] as const;

export const CERTIFICAT_SCOLARITE: TypeDocumentDefinition = {
  code: 'CERTIFICAT_SCOLARITE',
  prefixeFichier: 'certificat',
  champs: [
    {
      cle: 'classe',
      libelle: 'Classe',
      type: 'text',
      obligatoire: true,
      maxLength: 30,
      placeholder: 'Ex. CE1, 3ème A',
      eleveChamp: 'classe',
    },
    {
      cle: 'dateInscription',
      libelle: "Date d'inscription",
      type: 'date',
      obligatoire: true,
      eleveChamp: 'dateInscription',
    },
    {
      cle: 'assiduite',
      libelle: 'Assiduité',
      type: 'select',
      obligatoire: true,
      options: APPRECIATIONS_ASSIDUITE_CONDUITE,
    },
    {
      cle: 'conduite',
      libelle: 'Conduite',
      type: 'select',
      obligatoire: true,
      options: APPRECIATIONS_ASSIDUITE_CONDUITE,
    },
    {
      cle: 'travail',
      libelle: 'Travail',
      type: 'select',
      obligatoire: true,
      options: APPRECIATIONS_TRAVAIL,
    },
    {
      cle: 'observations',
      libelle: 'Observations particulières / Décision',
      type: 'textarea',
      obligatoire: false,
      maxLength: 300,
      placeholder: 'Ex. Passe en classe supérieure',
    },
  ],
  validerChamp: (champ, valeur, contexte) =>
    champ.cle === 'dateInscription'
      ? verifierDateInscription(valeur, contexte.eleve.dateNaissance)
      : null,
  rendre: rendreCertificatScolarite,
};
