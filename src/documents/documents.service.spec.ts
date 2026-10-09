import { ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import type { CreerDocumentDto } from './dto/creer-document.dto.js';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('../storage/storage.service.js', () => ({ StorageService: class {} }));
vi.mock('../notifications/notifications.service.js', () => ({
  NotificationsService: class {},
}));

const ETAB = 'etab-1';
const USER = 'user-1';

const eleve = {
  id: 'eleve-1',
  etablissementId: ETAB,
  matricule: 'CEG-0007',
  matriculeEducMaster: 'EM-7300322',
  nom: 'ADJAHO',
  prenoms: 'Nadège',
  sexe: 'FEMININ',
  dateNaissance: new Date('2014-07-15T00:00:00Z'),
  lieuNaissance: 'Cotonou',
  classe: null,
  dateInscription: null,
};

const etablissement = {
  id: ETAB,
  nom: 'CEG Godomey',
  commune: 'Abomey-Calavi',
  lieuParDefaut: null,
  adresse: null,
  telephone: null,
  email: null,
  ministereTutelle: null,
  directionDepartementale: null,
  devise: null,
  nomSignataire: 'Jean Dossou',
  fonctionSignataire: 'Le Directeur,',
  formatReference: 'N°{N}/{ANNEE}/CEG',
  prochainNumero: 12,
  logoChemin: null,
  signatureChemin: null,
  cachetChemin: null,
  anneeScolaireActive: { libelle: '2025-2026' },
};

const type = {
  id: 'type-1',
  code: 'CERTIFICAT_SCOLARITE',
  nom: 'Certificat de scolarité',
  actif: true,
};

const champs = {
  classe: 'CE1',
  dateInscription: '2023-06-22',
  assiduite: 'Bonne',
  conduite: 'Bonne',
  travail: 'Satisfaisant',
  observations: 'Passe au CE2',
};
const dto = {
  eleveId: 'eleve-1',
  typeDocumentId: 'type-1',
  champsSaisis: champs,
} as CreerDocumentDto;

function creer() {
  const tx = {
    etablissement: {
      // Prisma renvoie la valeur APRÈS incrément : 13 → le numéro attribué est 12.
      update: vi.fn().mockResolvedValue({ prochainNumero: 13 }),
    },
    eleve: { update: vi.fn().mockResolvedValue({}) },
    document: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          createdAt: new Date('2026-10-02T10:00:00Z'),
          statut: 'ACTIF',
          typeDocument: { nom: 'Certificat de scolarité' },
        }),
      ),
    },
  };
  const prisma = {
    typeDocument: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(type),
    },
    eleve: { findFirst: vi.fn().mockResolvedValue(eleve) },
    etablissement: { findUnique: vi.fn().mockResolvedValue(etablissement) },
    document: { findFirst: vi.fn().mockResolvedValue(null) },
    telechargementDocument: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const storage = {
    telecharger: vi.fn().mockResolvedValue(null),
    televerser: vi.fn().mockResolvedValue('chemin'),
    supprimer: vi.fn().mockResolvedValue(undefined),
    obtenirUrlSignee: vi.fn().mockResolvedValue('https://signee/doc.pdf'),
  };
  const config = {
    get: vi.fn((cle: string) =>
      cle === 'VERIFICATION_BASE_URL'
        ? 'https://scoly.app/verifier/'
        : undefined,
    ),
  };
  const notifications = {
    documentEtabli: vi.fn().mockResolvedValue(undefined),
  };
  const service = new DocumentsService(
    prisma as never,
    storage as never,
    config as never,
    notifications as never,
  );
  return { service, prisma, tx, storage, notifications };
}

describe('DocumentsService.creer', () => {
  it('attribue le numéro de référence, enregistre le PDF et fige les données', async () => {
    const { service, tx, storage } = creer();

    const res = await service.creer(ETAB, USER, dto);

    // Numéro : format des paramètres, compteur incrémenté atomiquement.
    expect(tx.etablissement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ETAB },
        data: { prochainNumero: { increment: 1 } },
      }),
    );
    const { data } = tx.document.create.mock.calls[0]![0];
    expect(data.numeroUnique).toBe('N°12/2025-2026/CEG');
    expect(res.numeroUnique).toBe('N°12/2025-2026/CEG');

    // Rattaché à l'établissement du JWT, avec le chemin de stockage attendu.
    expect(data.etablissementId).toBe(ETAB);
    expect(data.urlPdf).toBe(`etablissements/${ETAB}/documents/${data.id}.pdf`);
    const [chemin, pdf, mime] = storage.televerser.mock.calls[0]!;
    expect(chemin).toBe(data.urlPdf);
    expect((pdf as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(mime).toBe('application/pdf');

    // Jeton de QR code : non devinable, et QR basé sur l'URL configurée.
    expect(data.qrCodeToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    // Photographie de ce qui est imprimé.
    expect(data.donneesFigees.eleve.nom).toBe('ADJAHO');
    expect(data.donneesFigees.numero).toBe('N°12/2025-2026/CEG');
    expect(data.champsSaisis).toEqual({
      classe: 'CE1',
      dateInscription: '2023-06-22',
      assiduite: 'Bonne',
      conduite: 'Bonne',
      travail: 'Satisfaisant',
      observations: 'Passe au CE2',
    });
    expect(res.urlTelechargement).toBe('https://signee/doc.pdf');
  });

  it('enregistre l’auteur (utilisateur du JWT), le numéro d’ordre et le texte de recherche', async () => {
    const { service, tx } = creer();
    await service.creer(ETAB, USER, dto);

    const { data } = tx.document.create.mock.calls[0]![0];
    expect(data.etabliParId).toBe(USER);
    expect(data.numeroOrdre).toBe(12);
    // Référence + identité IMPRIMÉE (sans accents ni majuscules), sans la classe.
    expect(data.rechercheNormalisee).toBe(
      'n 12 2025 2026 ceg adjaho nadege ceg 0007 em 7300322',
    );
  });

  it('mémorise classe et date d’inscription sur l’élève, et met à jour sa recherche', async () => {
    const { service, tx } = creer();
    await service.creer(ETAB, USER, dto);

    expect(tx.eleve.update).toHaveBeenCalledWith({
      where: { id: 'eleve-1' },
      data: {
        classe: 'CE1',
        dateInscription: new Date('2023-06-22T00:00:00.000Z'),
        rechercheNormalisee: 'adjaho nadege ceg 0007 em 7300322 ce1',
      },
    });
  });

  it('ne touche pas l’élève si classe et date n’ont pas changé', async () => {
    const { service, prisma, tx } = creer();
    prisma.eleve.findFirst.mockResolvedValue({
      ...eleve,
      classe: 'CE1',
      dateInscription: new Date('2023-06-22T00:00:00Z'),
    });
    await service.creer(ETAB, USER, dto);
    expect(tx.eleve.update).not.toHaveBeenCalled();
  });

  it('refuse sans rien écrire quand les champs sont invalides', async () => {
    const { service, prisma, storage } = creer();
    await expect(
      service.creer(ETAB, USER, {
        ...dto,
        champsSaisis: { ...champs, classe: '' },
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        erreurs: [
          { champ: 'champsSaisis.classe', message: 'Classe est obligatoire.' },
        ],
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(storage.televerser).not.toHaveBeenCalled();
  });

  it('renvoie 404 pour un élève d’un autre établissement', async () => {
    const { service, prisma } = creer();
    prisma.eleve.findFirst.mockResolvedValue(null);
    await expect(service.creer(ETAB, USER, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.eleve.findFirst).toHaveBeenCalledWith({
      where: { id: 'eleve-1', etablissementId: ETAB },
    });
  });

  it('refuse un type de document pas encore disponible', async () => {
    const { service, prisma } = creer();
    prisma.typeDocument.findUnique.mockResolvedValue({
      ...type,
      code: 'FICHE_ELEVE',
      actif: false,
    });
    await expect(service.creer(ETAB, USER, dto)).rejects.toMatchObject({
      response: { code: 'TYPE_DOCUMENT_INDISPONIBLE' },
    });
  });

  it('refuse {ANNEE} sans année scolaire active, avant tout envoi de PDF', async () => {
    const { service, prisma, storage } = creer();
    prisma.etablissement.findUnique.mockResolvedValue({
      ...etablissement,
      anneeScolaireActive: null,
    });
    await expect(service.creer(ETAB, USER, dto)).rejects.toMatchObject({
      response: { code: 'ANNEE_SCOLAIRE_MANQUANTE' },
    });
    expect(storage.televerser).not.toHaveBeenCalled();
  });

  it('supprime le PDF envoyé si l’enregistrement échoue ensuite (pas d’orphelin)', async () => {
    const { service, tx, storage } = creer();
    tx.document.create.mockRejectedValue(new Error('panne base'));

    await expect(service.creer(ETAB, USER, dto)).rejects.toThrow('panne base');
    expect(storage.supprimer).toHaveBeenCalledWith(
      storage.televerser.mock.calls[0]![0],
    );
  });

  it('ne supprime rien si le PDF n’a pas été envoyé', async () => {
    const { service, tx, storage } = creer();
    tx.etablissement.update.mockRejectedValue(new Error('panne base'));
    await expect(service.creer(ETAB, USER, dto)).rejects.toThrow();
    expect(storage.supprimer).not.toHaveBeenCalled();
  });

  it('prévient les collègues du document établi (auteur du JWT exclu côté service)', async () => {
    const { service, notifications } = creer();
    await service.creer(ETAB, USER, dto);

    expect(notifications.documentEtabli).toHaveBeenCalledOnce();
    expect(notifications.documentEtabli.mock.calls[0]![0]).toMatchObject({
      etablissementId: ETAB,
      auteurId: USER,
      eleveNomComplet: 'Nadège ADJAHO',
    });
  });

  it('ne notifie rien quand la génération échoue', async () => {
    const { service, tx, notifications } = creer();
    tx.document.create.mockRejectedValueOnce(new Error('boom'));
    await expect(service.creer(ETAB, USER, dto)).rejects.toThrow();

    expect(notifications.documentEtabli).not.toHaveBeenCalled();
  });

  describe('idempotence', () => {
    const CLE = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
    const existant = {
      id: 'doc-existant',
      numeroUnique: 'N°11/2025-2026/CEG',
      statut: 'ACTIF',
      eleveId: 'eleve-1',
      typeDocumentId: 'type-1',
      dateEmission: new Date('2026-10-02T00:00:00Z'),
      createdAt: new Date(),
      urlPdf: 'chemin/existant.pdf',
      donneesFigees: { eleve: { nom: 'Adjaho', prenoms: 'Nadège' } },
      typeDocument: { nom: 'Certificat de scolarité' },
    };

    it('renvoie le document déjà créé avec la même clé, sans consommer de numéro', async () => {
      const { service, prisma, tx } = creer();
      prisma.document.findFirst.mockResolvedValue(existant);

      const res = await service.creer(ETAB, USER, dto, CLE);

      expect(res.id).toBe('doc-existant');
      expect(prisma.document.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { etablissementId: ETAB, cleIdempotence: CLE },
        }),
      );
      expect(tx.etablissement.update).not.toHaveBeenCalled();
    });

    it('en cas de course (violation d’unicité), renvoie le document de la requête jumelle', async () => {
      const { service, prisma, tx, storage } = creer();
      prisma.document.findFirst
        .mockResolvedValueOnce(null) // vérification initiale
        .mockResolvedValueOnce(existant); // après la collision
      tx.document.create.mockRejectedValue({ code: 'P2002' });

      const res = await service.creer(ETAB, USER, dto, CLE);

      expect(res.id).toBe('doc-existant');
      expect(storage.supprimer).toHaveBeenCalled(); // son propre PDF est nettoyé
    });

    it('transmet la clé au document créé', async () => {
      const { service, tx } = creer();
      await service.creer(ETAB, USER, dto, CLE);
      expect(tx.document.create.mock.calls[0]![0].data.cleIdempotence).toBe(
        CLE,
      );
    });
  });

  it('traduit une collision de numéro sans clé en 409', async () => {
    const { service, tx } = creer();
    tx.document.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.creer(ETAB, USER, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('DocumentsService.apercu', () => {
  it('rend un PDF sans rien écrire ni consommer de numéro', async () => {
    const { service, prisma, tx, storage } = creer();

    const { pdf, nomFichier } = await service.apercu(ETAB, dto);

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(nomFichier).toBe('certificat_ADJAHO_Nadège.pdf');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.etablissement.update).not.toHaveBeenCalled();
    expect(tx.eleve.update).not.toHaveBeenCalled();
    expect(tx.document.create).not.toHaveBeenCalled();
    expect(storage.televerser).not.toHaveBeenCalled();
  });

  it('valide les champs comme la génération', async () => {
    const { service } = creer();
    await expect(
      service.apercu(ETAB, { ...dto, champsSaisis: {} }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });
});

describe('DocumentsService.listerTypes', () => {
  it('marque « disponible » seulement un type actif ayant un modèle, avec ses champs', async () => {
    const { service, prisma } = creer();
    prisma.typeDocument.findMany.mockResolvedValue([
      { ...type, description: null, categorie: 'SCOLARITE', ordre: 1 },
      {
        id: 't2',
        code: 'FICHE_ELEVE',
        nom: 'Fiche élève',
        description: null,
        categorie: 'SCOLARITE',
        ordre: 2,
        actif: false,
      },
      {
        id: 't3',
        code: 'INCONNU',
        nom: 'Sans modèle',
        description: null,
        categorie: 'SCOLARITE',
        ordre: 3,
        actif: true,
      },
    ]);

    const types = await service.listerTypes();

    expect(types.map((t) => t.disponible)).toEqual([true, false, false]);
    expect(types[0]!.champs.map((c) => c.cle)).toEqual([
      'classe',
      'dateInscription',
      'assiduite',
      'conduite',
      'travail',
      'observations',
    ]);
    expect(
      types[0]!.champs.find((c) => c.cle === 'assiduite')!.options,
    ).toEqual(['Excellente', 'Bonne', 'Moyenne', 'Insuffisante']);
    expect(types[1]!.champs).toEqual([]);
  });
});

describe('DocumentsService.urlTelechargement', () => {
  it('borne la recherche à l’établissement et force le téléchargement sous le nom prévu', async () => {
    const { service, prisma, storage } = creer();
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc-1',
      statut: 'ACTIF',
      urlPdf: 'chemin/doc.pdf',
      numeroUnique: 'N°1/2025-2026/CEG',
      typeDocument: { nom: 'Certificat de scolarité' },
      donneesFigees: { eleve: { nom: 'Anagonou', prenoms: 'Lince Junior' } },
    });

    const res = await service.urlTelechargement(ETAB, USER, 'doc-1');

    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1', etablissementId: ETAB },
      }),
    );
    expect(storage.obtenirUrlSignee).toHaveBeenCalledWith(
      'chemin/doc.pdf',
      'Certificat de scolarite - ANAGONOU Lince Junior.pdf',
    );
    expect(res).toEqual({ url: 'https://signee/doc.pdf' });
  });

  it('le nom vient des données figées : corriger l’élève ensuite ne le change pas', async () => {
    const { service, prisma, storage } = creer();
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc-1',
      statut: 'ACTIF',
      urlPdf: 'chemin/doc.pdf',
      typeDocument: { nom: 'Certificat de scolarité' },
      donneesFigees: { eleve: { nom: 'Ancien', prenoms: 'Nom' } },
    });
    await service.urlTelechargement(ETAB, USER, 'doc-1');
    expect(storage.obtenirUrlSignee.mock.calls[0]![1]).toBe(
      'Certificat de scolarite - ANCIEN Nom.pdf',
    );
  });

  it('trace le téléchargement (qui, quel document) après avoir obtenu le lien', async () => {
    const { service, prisma } = creer();
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc-1',
      statut: 'ACTIF',
      urlPdf: 'chemin/doc.pdf',
      typeDocument: { nom: 'Certificat de scolarité' },
      donneesFigees: { eleve: { nom: 'Anagonou', prenoms: 'Lince' } },
    });

    await service.urlTelechargement(ETAB, USER, 'doc-1');

    expect(prisma.telechargementDocument.create).toHaveBeenCalledWith({
      data: { documentId: 'doc-1', utilisateurId: USER },
    });
  });

  it('refuse (409 DOCUMENT_ANNULE) le téléchargement d’un document annulé, sans lien ni trace', async () => {
    const { service, prisma, storage } = creer();
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc-1',
      statut: 'ANNULE',
      urlPdf: 'chemin/doc.pdf',
      typeDocument: { nom: 'Certificat de scolarité' },
      donneesFigees: { eleve: { nom: 'A', prenoms: 'B' } },
    });

    await expect(
      service.urlTelechargement(ETAB, USER, 'doc-1'),
    ).rejects.toMatchObject({
      response: { code: 'DOCUMENT_ANNULE' },
    });
    expect(storage.obtenirUrlSignee).not.toHaveBeenCalled();
    expect(prisma.telechargementDocument.create).not.toHaveBeenCalled();
  });

  it('n’envoie aucun lien si la trace ne peut pas être écrite', async () => {
    const { service, prisma } = creer();
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc-1',
      statut: 'ACTIF',
      urlPdf: 'chemin/doc.pdf',
      typeDocument: { nom: 'Certificat de scolarité' },
      donneesFigees: { eleve: { nom: 'A', prenoms: 'B' } },
    });
    prisma.telechargementDocument.create.mockRejectedValue(new Error('panne'));

    await expect(
      service.urlTelechargement(ETAB, USER, 'doc-1'),
    ).rejects.toThrow('panne');
  });

  it('renvoie 404 pour un document d’un autre établissement', async () => {
    const { service } = creer();
    await expect(
      service.urlTelechargement(ETAB, USER, 'doc-x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renvoie 404 pour un document sans PDF', async () => {
    const { service, prisma } = creer();
    prisma.document.findFirst.mockResolvedValue({ urlPdf: null });
    await expect(
      service.urlTelechargement(ETAB, USER, 'doc-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('lien de téléchargement renvoyé par la génération', () => {
  const NOM_ATTENDU = 'Certificat de scolarite - ADJAHO Nadege.pdf';

  it('force le téléchargement sous le nom prévu (POST /documents)', async () => {
    const { service, storage } = creer();
    const res = await service.creer(ETAB, USER, dto);

    expect(res.urlTelechargement).toBe('https://signee/doc.pdf');
    const [chemin, nom] = storage.obtenirUrlSignee.mock.calls[0]!;
    expect(chemin).toMatch(
      new RegExp(`^etablissements/${ETAB}/documents/.+\\.pdf$`),
    );
    expect(nom).toBe(NOM_ATTENDU);
  });

  it('le rejeu d’une même Idempotency-Key renvoie un lien qui force aussi le téléchargement', async () => {
    const { service, prisma, storage } = creer();
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc-existant',
      numeroUnique: 'N°11/2025-2026/CEG',
      statut: 'ACTIF',
      eleveId: 'eleve-1',
      typeDocumentId: 'type-1',
      dateEmission: new Date('2026-10-02T00:00:00Z'),
      createdAt: new Date(),
      urlPdf: 'chemin/existant.pdf',
      donneesFigees: { eleve: { nom: 'Adjaho', prenoms: 'Nadège' } },
      typeDocument: { nom: 'Certificat de scolarité' },
    });

    await service.creer(
      ETAB,
      USER,
      dto,
      '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    );

    expect(storage.obtenirUrlSignee).toHaveBeenCalledWith(
      'chemin/existant.pdf',
      NOM_ATTENDU,
    );
  });

  it('le lien de la génération et celui du re-téléchargement portent le même nom', async () => {
    const { service, prisma, storage } = creer();
    await service.creer(ETAB, USER, dto);
    const nomGeneration = storage.obtenirUrlSignee.mock.calls[0]![1];

    prisma.document.findFirst.mockResolvedValue({
      urlPdf: 'chemin/doc.pdf',
      typeDocument: { nom: 'Certificat de scolarité' },
      donneesFigees: { eleve: { nom: 'ADJAHO', prenoms: 'Nadège' } },
    });
    await service.urlTelechargement(ETAB, USER, 'doc-1');

    expect(storage.obtenirUrlSignee.mock.calls[1]![1]).toBe(nomGeneration);
  });

  it('l’aperçu ne génère aucun lien signé (flux direct)', async () => {
    const { service, storage } = creer();
    await service.apercu(ETAB, dto);
    expect(storage.obtenirUrlSignee).not.toHaveBeenCalled();
  });
});
