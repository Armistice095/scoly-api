import type { DocumentPourVerification } from '../../src/verification-document/verification-document.mapper.js';

/** Jeton QR valide (32 caractères base64url). */
export const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';

/** Valeurs sensibles semées dans le snapshot : AUCUNE ne doit apparaître dans une réponse publique. */
export const SECRETS = [
  '2012-04-17', // date de naissance
  'Cotonou', // lieu de naissance
  'MAT-998877', // matricule
  'EM-554433', // matricule EducMaster
  'MOTIF-INTERNE', // motif d'annulation / champ saisi
  'Rue des Palmiers 12', // adresse de l'école
  'Akpovi', // nom complet (seule l'initiale est publique)
  'Marie Claire', // 2e prénom
  'doc-uuid-interne', // identifiant interne
  'https://scoly.app/verifier', // URL du QR
  TOKEN,
];

export function documentBrut(
  surcharge: Partial<DocumentPourVerification> = {},
): DocumentPourVerification {
  return {
    id: 'doc-uuid-interne',
    numeroUnique: 'N°0042/2025-2026/CEG-GODOMEY',
    statut: 'ACTIF',
    dateEmission: new Date('2026-09-28T00:00:00Z'),
    donneesFigees: {
      etablissement: {
        nom: 'CEG Godomey',
        ministereTutelle: null,
        directionDepartementale: null,
        devise: null,
        adresse: 'Rue des Palmiers 12',
        telephone: '+229 01 11 11 11 11',
        email: 'ancien@ceg-godomey.bj',
        nomSignataire: 'Directeur X',
        fonctionSignataire: 'Directeur',
        lieu: 'Godomey',
      },
      anneeScolaire: '2025-2026',
      eleve: {
        nom: 'Akpovi',
        prenoms: 'Adjovi Marie Claire',
        sexe: 'FEMININ',
        dateNaissance: '2012-04-17',
        lieuNaissance: 'Cotonou',
        matricule: 'MAT-998877',
        matriculeEducMaster: 'EM-554433',
      },
      champs: { motifTransfert: 'MOTIF-INTERNE' },
      numero: 'N°0042/2025-2026/CEG-GODOMEY',
      dateEmission: '2026-09-28',
      urlVerification: `https://scoly.app/verifier/${TOKEN}`,
      apercu: false,
    },
    typeDocument: { nom: 'Certificat de scolarité' },
    etablissement: {
      nom: 'CEG Godomey (renommé)',
      commune: 'Abomey-Calavi',
      departement: 'Atlantique',
      telephone: '+229 01 00 00 00 00',
      email: 'secretariat@ceg-godomey.bj',
    },
    annulation: null,
    ...surcharge,
  } as DocumentPourVerification;
}

export const documentAnnule = () =>
  documentBrut({
    statut: 'ANNULE',
    // 30 sept. 2026 à 23:30 UTC = 1er oct. 00:30 à Porto-Novo (UTC+1) : teste le fuseau.
    annulation: { createdAt: new Date('2026-09-30T23:30:00Z') },
  });
