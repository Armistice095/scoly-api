import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArchivesService } from './archives.service.js';
import type { ListerArchivesQueryDto } from './dto/lister-archives-query.dto.js';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('../storage/storage.service.js', () => ({ StorageService: class {} }));
vi.mock('../documents/documents.service.js', () => ({
  DocumentsService: class {},
}));
vi.mock('../notifications/notifications.service.js', () => ({
  NotificationsService: class {},
}));

const ETAB = 'etab-1';
const USER = 'user-1';
const DOC = 'doc-1';

const membre = {
  id: USER,
  nomComplet: 'Mireille',
  fonction: 'Secrétaire',
  email: 'm@e.bj',
};

const ligneBrute = {
  id: DOC,
  numeroUnique: 'N°24/2025-2026/CEG',
  statut: 'ACTIF',
  createdAt: new Date('2026-10-03T13:31:00Z'),
  dateEmission: new Date('2026-10-03T00:00:00Z'),
  eleveId: 'eleve-1',
  donneesFigees: {
    eleve: {
      nom: 'Akpovi',
      prenoms: 'Adjovi',
      matricule: null,
      matriculeEducMaster: null,
    },
  },
  typeDocument: { id: 't1', code: 'C', nom: 'Certificat' },
  annulation: null,
};
const detailBrut = {
  ...ligneBrute,
  etabliPar: membre,
  telechargements: [],
  _count: { telechargements: 0 },
};

const query = (surcharge: Partial<ListerArchivesQueryDto> = {}) =>
  ({
    page: 1,
    limit: 10,
    tri: 'recent',
    ...surcharge,
  }) as ListerArchivesQueryDto;

function creer() {
  const tx = {
    document: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue({ id: DOC }),
    },
    annulation: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    document: {
      count: vi.fn().mockResolvedValue(25),
      findMany: vi.fn().mockResolvedValue([ligneBrute]),
      findFirst: vi.fn().mockResolvedValue(detailBrut),
    },
    // Même forme que Prisma : tableau de requêtes ou fonction transactionnelle.
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (t: typeof tx) => unknown)(tx),
    ),
  };
  const storage = {
    telecharger: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7')),
  };
  const documents = {
    urlTelechargement: vi
      .fn()
      .mockResolvedValue({ url: 'https://signee/doc.pdf' }),
  };
  const notifications = {
    documentAnnule: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ArchivesService(
    prisma as never,
    storage as never,
    documents as never,
    notifications as never,
  );
  return { service, prisma, tx, storage, documents, notifications };
}

describe('ArchivesService.lister', () => {
  it('borne TOUJOURS la requête à l’établissement du JWT', async () => {
    const { service, prisma } = creer();
    await service.lister(ETAB, query());

    expect(prisma.document.count.mock.calls[0]![0].where).toEqual({
      etablissementId: ETAB,
    });
    expect(
      prisma.document.findMany.mock.calls[0]![0].where.etablissementId,
    ).toBe(ETAB);
  });

  it('pagine et renvoie le total (compte et page lus ensemble)', async () => {
    const { service, prisma } = creer();
    const res = await service.lister(ETAB, query({ page: 3, limit: 10 }));

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.document.findMany.mock.calls[0]![0]).toMatchObject({
      skip: 20,
      take: 10,
    });
    expect(res.meta).toEqual({ total: 25, page: 3, limit: 10, totalPages: 3 });
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({
      reference: 'N°24/2025-2026/CEG',
      eleve: { nomComplet: 'Adjovi Akpovi' },
    });
  });

  it('plus récents d’abord par défaut, avec l’id en départage (pagination stable)', async () => {
    const { service, prisma } = creer();
    await service.lister(ETAB, query());
    expect(prisma.document.findMany.mock.calls[0]![0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('tri « ancien » : plus anciens d’abord', async () => {
    const { service, prisma } = creer();
    await service.lister(ETAB, query({ tri: 'ancien' }));
    expect(prisma.document.findMany.mock.calls[0]![0].orderBy).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('applique statut, type et élève', async () => {
    const { service, prisma } = creer();
    await service.lister(
      ETAB,
      query({ statut: 'ANNULE', typeDocumentId: 't1', eleveId: 'eleve-1' }),
    );
    expect(prisma.document.count.mock.calls[0]![0].where).toEqual({
      etablissementId: ETAB,
      statut: 'ANNULE',
      typeDocumentId: 't1',
      eleveId: 'eleve-1',
    });
  });

  it('la recherche exige TOUS les mots, sans accents ni casse, dans le texte normalisé', async () => {
    const { service, prisma } = creer();
    await service.lister(ETAB, query({ search: '  Adjovi  N°24 ' }));

    expect(prisma.document.count.mock.calls[0]![0].where.AND).toEqual([
      { rechercheNormalisee: { contains: 'adjovi' } },
      { rechercheNormalisee: { contains: 'n' } },
      { rechercheNormalisee: { contains: '24' } },
    ]);
  });

  it('une recherche faite de symboles n’ajoute aucun filtre (et ne fait pas échouer la requête)', async () => {
    const { service, prisma } = creer();
    await service.lister(ETAB, query({ search: '%_;--' }));
    expect(prisma.document.count.mock.calls[0]![0].where).toEqual({
      etablissementId: ETAB,
    });
  });

  it('ne charge que les colonnes utiles à la liste (pas de champs saisis)', async () => {
    const { service, prisma } = creer();
    await service.lister(ETAB, query());
    const { select } = prisma.document.findMany.mock.calls[0]![0];
    expect(select).toBeDefined();
    expect(select).not.toHaveProperty('champsSaisis');
    expect(select).not.toHaveProperty('urlPdf');
    expect(select).not.toHaveProperty('qrCodeToken');
  });

  it('liste vide : totalPages vaut 0', async () => {
    const { service, prisma } = creer();
    prisma.document.count.mockResolvedValue(0);
    prisma.document.findMany.mockResolvedValue([]);
    const res = await service.lister(ETAB, query());
    expect(res).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  });
});

describe('ArchivesService.recuperer', () => {
  it('cherche par id ET établissement', async () => {
    const { service, prisma } = creer();
    await service.recuperer(ETAB, DOC);
    expect(prisma.document.findFirst.mock.calls[0]![0].where).toEqual({
      id: DOC,
      etablissementId: ETAB,
    });
  });

  it('404 pour un document d’un autre établissement (ou inexistant)', async () => {
    const { service, prisma } = creer();
    prisma.document.findFirst.mockResolvedValue(null);
    await expect(service.recuperer(ETAB, 'inconnu')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ArchivesService.annuler', () => {
  const dto = { motif: 'Erreur sur le nom de l’élève' };

  it('bascule le statut ET enregistre qui/pourquoi, dans une seule transaction', async () => {
    const { service, prisma, tx } = creer();
    await service.annuler(ETAB, USER, DOC, dto);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.document.updateMany).toHaveBeenCalledWith({
      where: { id: DOC, etablissementId: ETAB, statut: 'ACTIF' },
      data: { statut: 'ANNULE' },
    });
    expect(tx.annulation.create).toHaveBeenCalledWith({
      data: { documentId: DOC, motif: dto.motif, annuleParId: USER },
    });
  });

  it('prévient les collègues APRÈS l’annulation (élève tel qu’imprimé)', async () => {
    const { service, notifications } = creer();
    await service.annuler(ETAB, USER, DOC, dto);

    expect(notifications.documentAnnule).toHaveBeenCalledWith({
      etablissementId: ETAB,
      auteurId: USER,
      documentId: DOC,
      typeDocumentNom: 'Certificat',
      eleveNomComplet: 'Adjovi Akpovi',
    });
  });

  it('ne notifie personne quand l’annulation échoue', async () => {
    const { service, tx, notifications } = creer();
    tx.document.updateMany.mockResolvedValue({ count: 0 });
    tx.document.findFirst.mockResolvedValue({ id: DOC });
    await expect(service.annuler(ETAB, USER, DOC, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(notifications.documentAnnule).not.toHaveBeenCalled();
  });

  it('l’auteur vient du JWT, jamais du corps de la requête', async () => {
    const { service, tx } = creer();
    await service.annuler(ETAB, USER, DOC, {
      ...dto,
      annuleParId: 'pirate',
    } as never);
    expect(tx.annulation.create.mock.calls[0]![0].data.annuleParId).toBe(USER);
  });

  it('renvoie la fiche à jour', async () => {
    const { service } = creer();
    const res = await service.annuler(ETAB, USER, DOC, dto);
    expect(res).toMatchObject({ id: DOC, reference: 'N°24/2025-2026/CEG' });
  });

  it('409 DOCUMENT_DEJA_ANNULE si le document est déjà annulé — sans second enregistrement', async () => {
    const { service, tx } = creer();
    tx.document.updateMany.mockResolvedValue({ count: 0 });
    tx.document.findFirst.mockResolvedValue({ id: DOC });

    await expect(service.annuler(ETAB, USER, DOC, dto)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_DEJA_ANNULE' },
    });
    expect(tx.annulation.create).not.toHaveBeenCalled();
  });

  it('deux annulations simultanées : une seule passe, l’autre reçoit 409', async () => {
    const { service, tx } = creer();
    tx.document.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const [a, b] = await Promise.allSettled([
      service.annuler(ETAB, USER, DOC, dto),
      service.annuler(ETAB, 'user-2', DOC, dto),
    ]);

    expect(a.status).toBe('fulfilled');
    expect(b.status).toBe('rejected');
    expect((b as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );
    expect(tx.annulation.create).toHaveBeenCalledOnce();
  });

  it('404 pour un document d’un autre établissement (rien n’est modifié)', async () => {
    const { service, tx } = creer();
    tx.document.updateMany.mockResolvedValue({ count: 0 });
    tx.document.findFirst.mockResolvedValue(null);

    await expect(
      service.annuler(ETAB, USER, 'autre', dto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.document.findFirst.mock.calls[0]![0].where).toEqual({
      id: 'autre',
      etablissementId: ETAB,
    });
    expect(tx.annulation.create).not.toHaveBeenCalled();
  });

  it('traduit une violation d’unicité de l’annulation en 409', async () => {
    const { service, tx } = creer();
    tx.annulation.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.annuler(ETAB, USER, DOC, dto)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_DEJA_ANNULE' },
    });
  });

  it('laisse remonter une panne inattendue (la transaction est annulée)', async () => {
    const { service, tx } = creer();
    tx.annulation.create.mockRejectedValue(new Error('panne base'));
    await expect(service.annuler(ETAB, USER, DOC, dto)).rejects.toThrow(
      'panne base',
    );
  });
});

describe('ArchivesService.urlTelechargement', () => {
  it('délègue à DocumentsService (même règle : tracé, refusé si annulé)', async () => {
    const { service, documents } = creer();
    const res = await service.urlTelechargement(ETAB, USER, DOC);
    expect(documents.urlTelechargement).toHaveBeenCalledWith(ETAB, USER, DOC);
    expect(res).toEqual({ url: 'https://signee/doc.pdf' });
  });
});

describe('ArchivesService.apercu', () => {
  const brut = {
    urlPdf: 'etablissements/etab-1/documents/doc-1.pdf',
    donneesFigees: { eleve: { nom: 'Akpovi', prenoms: 'Adjovi' } },
    typeDocument: { nom: 'Certificat de scolarité' },
  };

  it('renvoie le PDF et un nom de fichier sûr', async () => {
    const { service, prisma, storage } = creer();
    prisma.document.findFirst.mockResolvedValue(brut);

    const res = await service.apercu(ETAB, DOC);

    expect(prisma.document.findFirst.mock.calls[0]![0].where).toEqual({
      id: DOC,
      etablissementId: ETAB,
    });
    expect(storage.telecharger).toHaveBeenCalledWith(brut.urlPdf);
    expect(res.pdf.toString()).toBe('%PDF-1.7');
    expect(res.nomFichier).toBe('Certificat de scolarite - AKPOVI Adjovi.pdf');
  });

  it('fonctionne aussi pour un document annulé (consultation) et ne trace rien', async () => {
    const { service, prisma } = creer();
    prisma.document.findFirst.mockResolvedValue({ ...brut, statut: 'ANNULE' });
    await expect(service.apercu(ETAB, DOC)).resolves.toBeDefined();
    expect(prisma.document).not.toHaveProperty('create');
  });

  it('404 si le document n’existe pas pour cet établissement', async () => {
    const { service, prisma } = creer();
    prisma.document.findFirst.mockResolvedValue(null);
    await expect(service.apercu(ETAB, DOC)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404 explicite si le fichier a disparu du stockage', async () => {
    const { service, prisma, storage } = creer();
    prisma.document.findFirst.mockResolvedValue(brut);
    storage.telecharger.mockResolvedValue(null);
    await expect(service.apercu(ETAB, DOC)).rejects.toThrow(
      'Le fichier PDF de ce document est introuvable.',
    );
  });
});
