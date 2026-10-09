/**
 * Script de seed — crée un établissement de test, un utilisateur, quelques
 * élèves fictifs et le type de document "Certificat de scolarité".
 *
 * Exécution : pnpm prisma db seed
 */
import { construireTexteRecherche } from '../src/eleves/utils/recherche.js';
import {
  CategorieDocument,
  OrdreEnseignement,
  PrismaClient,
  RoleUtilisateur,
  Sexe,
  StatutEleve,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const etablissement = await prisma.etablissement.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      nom: 'CEG Godomey (établissement de test)',
      ordreEnseignement: OrdreEnseignement.SECONDAIRE,
      departement: 'Atlantique',
      commune: 'Abomey-Calavi',
      adresse: 'Quartier Godomey, Abomey-Calavi',
      numeroAgrement: 'AGR-0142',
      telephone: '+22901970000',
      email: 'ceg.godomey@exemple.bj',
      directionDepartementale: "Direction départementale de l'Atlantique",
      ministereTutelle:
        'Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle',
      devise: 'Fraternité – Justice – Travail',
      nomSignataire: 'Hervé Agbodjan',
      fonctionSignataire: 'Directeur',
      formatReference: 'N°{N}/{ANNEE}/CEG-GODOMEY',
      lieuParDefaut: 'Abomey-Calavi',
    },
  });

  const anneeScolaire = await prisma.anneeScolaire.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      etablissementId: etablissement.id,
      libelle: '2025-2026',
      dateRentree: new Date('2025-09-15'),
      dateFin: new Date('2026-07-10'),
    },
  });

  await prisma.etablissement.update({
    where: { id: etablissement.id },
    data: { anneeScolaireActiveId: anneeScolaire.id },
  });

  const motDePasseHash = await bcrypt.hash('motdepasse123', 10);

  const utilisateur = await prisma.utilisateur.upsert({
    where: { email: 'demo@scoly.test' },
    update: {},
    create: {
      etablissementId: etablissement.id,
      nomComplet: 'Hervé Agbodjan',
      fonction: 'Directeur',
      email: 'demo@scoly.test',
      telephone: '+22901970001',
      motDePasseHash,
      role: RoleUtilisateur.DIRECTEUR,
      emailVerifieLe: new Date(),
    },
  });

  // Les champs et le modèle PDF de chaque type sont dans le code
  // (src/documents/types). Seul le certificat de scolarité a son modèle pour
  // l'instant ; les autres sont visibles mais « Bientôt disponible ».
  const typesDocuments = [
    {
      code: 'CERTIFICAT_SCOLARITE',
      nom: 'Certificat de scolarité',
      description:
        "Atteste qu'un élève est régulièrement inscrit dans l'établissement.",
      categorie: CategorieDocument.SCOLARITE,
      ordre: 1,
      actif: true,
    },
    {
      code: 'ATTESTATION_INSCRIPTION',
      nom: "Attestation d'inscription",
      description: "Confirme l'inscription de l'élève pour l'année en cours.",
      categorie: CategorieDocument.SCOLARITE,
      ordre: 2,
      actif: false,
    },
    {
      code: 'FICHE_ELEVE',
      nom: 'Fiche élève',
      description: "Regroupe l'identité et le parcours scolaire de l'élève.",
      categorie: CategorieDocument.SCOLARITE,
      ordre: 3,
      actif: false,
    },
    {
      code: 'ATTESTATION_TRANSFERT',
      nom: 'Attestation de transfert',
      description:
        "Confirme le transfert de l'élève vers un autre établissement.",
      categorie: CategorieDocument.TRANSFERTS_DEPARTS,
      ordre: 4,
      actif: false,
    },
    {
      code: 'DEMANDE_TRANSFERT',
      nom: 'Demande de transfert',
      description:
        'Formalise la demande de transfert introduite par la famille.',
      categorie: CategorieDocument.TRANSFERTS_DEPARTS,
      ordre: 5,
      actif: false,
    },
  ];

  for (const type of typesDocuments) {
    await prisma.typeDocument.upsert({
      where: { code: type.code },
      update: {
        nom: type.nom,
        description: type.description,
        categorie: type.categorie,
        ordre: type.ordre,
        actif: type.actif,
      },
      create: type,
    });
  }
  const typeDocument = typesDocuments[0]!;

  const elevesDeTest = [
    {
      matricule: 'CEG-0001',
      matriculeEducMaster: 'EM-7300001',
      nom: 'NOUWATIN',
      prenoms: 'Jérémie',
      sexe: Sexe.MASCULIN,
      dateNaissance: new Date('2014-06-14'),
      lieuNaissance: 'Comé',
      parentTuteur: 'M. Basile Nouwatin',
      telephone: '+2290197164676',
      adresse: 'Quartier Togoudo, Abomey-Calavi',
      classe: 'CM2',
      dateInscription: new Date('2022-09-12'),
    },
    {
      matricule: 'CEG-0002',
      matriculeEducMaster: null,
      nom: 'AGOSSOU',
      prenoms: 'Chimène',
      sexe: Sexe.FEMININ,
      dateNaissance: new Date('2013-03-02'),
      lieuNaissance: 'Abomey-Calavi',
      parentTuteur: 'Mme Akouavi Dossou',
      telephone: '+2290196000001',
      adresse: null,
      classe: null, // vide : renseignée à la 1re génération d'un certificat
      dateInscription: null,
    },
  ];

  for (const eleve of elevesDeTest) {
    // Idempotent via la contrainte unique (établissement, matricule) : relancer
    // le seed ne duplique rien. Les ids sont des UUID générés (les routes
    // /eleves/:id refusent les ids qui ne sont pas des UUID).
    await prisma.eleve.upsert({
      where: {
        etablissementId_matricule: {
          etablissementId: etablissement.id,
          matricule: eleve.matricule,
        },
      },
      update: {},
      create: {
        etablissementId: etablissement.id,
        statut: StatutEleve.ACTIF,
        rechercheNormalisee: construireTexteRecherche(eleve),
        ...eleve,
      },
    });
  }

  console.log('Seed terminé :', {
    etablissement: etablissement.nom,
    utilisateur: utilisateur.email,
    typeDocument: typeDocument.nom,
    nbEleves: elevesDeTest.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
