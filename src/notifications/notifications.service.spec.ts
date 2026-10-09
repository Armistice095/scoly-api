import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import type { ListerNotificationsQueryDto } from './dto/lister-notifications-query.dto.js';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));

const ETAB = 'etab-1';
const USER = 'user-1';
const NOTIF = 'notif-1';

const brute = {
  id: NOTIF,
  etablissementId: ETAB,
  utilisateurId: USER,
  type: 'DOCUMENT_ETABLI',
  categorie: 'DOCUMENTS',
  titre: 'Document établi',
  message: 'Certificat de scolarité pour Adjovi Akpovi.',
  documentId: 'doc-1',
  membreId: null,
  lueLe: null,
  createdAt: new Date('2026-10-09T08:30:00Z'),
};

const query = (surcharge: Partial<ListerNotificationsQueryDto> = {}) =>
  ({
    statut: 'toutes',
    page: 1,
    limite: 10,
    ...surcharge,
  }) as ListerNotificationsQueryDto;

function creer() {
  const prisma = {
    notification: {
      count: vi.fn().mockResolvedValue(3),
      findMany: vi.fn().mockResolvedValue([brute]),
      findFirst: vi.fn().mockResolvedValue(brute),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    utilisateur: {
      findMany: vi.fn().mockResolvedValue([{ id: 'u2' }, { id: 'u3' }]),
    },
    $transaction: vi.fn((arg: unknown) =>
      Promise.all(arg as Promise<unknown>[]),
    ),
  };
  return { service: new NotificationsService(prisma as never), prisma };
}

describe('NotificationsService.lister', () => {
  it('borne TOUJOURS la requête au destinataire du JWT', async () => {
    const { service, prisma } = creer();
    await service.lister(USER, query());

    expect(prisma.notification.count.mock.calls[0]![0].where).toEqual({
      utilisateurId: USER,
    });
    expect(
      prisma.notification.findMany.mock.calls[0]![0].where.utilisateurId,
    ).toBe(USER);
  });

  it('trie la plus récente d’abord, avec l’id pour départager', async () => {
    const { service, prisma } = creer();
    await service.lister(USER, query());
    expect(prisma.notification.findMany.mock.calls[0]![0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('applique les filtres non lues / type / catégorie', async () => {
    const { service, prisma } = creer();
    await service.lister(
      USER,
      query({
        statut: 'non-lues',
        type: 'DOCUMENT_ANNULE',
        categorie: 'DOCUMENTS',
      }),
    );
    expect(prisma.notification.findMany.mock.calls[0]![0].where).toEqual({
      utilisateurId: USER,
      lueLe: null,
      type: 'DOCUMENT_ANNULE',
      categorie: 'DOCUMENTS',
    });
  });

  it('pagine, et le total des non lues ignore les filtres', async () => {
    const { service, prisma } = creer();
    const res = await service.lister(
      USER,
      query({ page: 2, limite: 5, type: 'DOCUMENT_ETABLI' }),
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.notification.findMany.mock.calls[0]![0]).toMatchObject({
      skip: 5,
      take: 5,
    });
    // 3e appel de count = non lues, sans le filtre de type.
    expect(prisma.notification.count.mock.calls[1]![0]).toEqual({
      where: { utilisateurId: USER, lueLe: null },
    });
    expect(res.meta).toEqual({
      total: 3,
      page: 2,
      limite: 5,
      totalPages: 1,
      nonLues: 3,
    });
  });

  it('n’expose ni l’établissement ni le destinataire', async () => {
    const { service } = creer();
    const { data } = await service.lister(USER, query());
    expect(data[0]).toEqual({
      id: NOTIF,
      type: 'DOCUMENT_ETABLI',
      categorie: 'DOCUMENTS',
      titre: 'Document établi',
      message: 'Certificat de scolarité pour Adjovi Akpovi.',
      lue: false,
      lueLe: null,
      documentId: 'doc-1',
      membreId: null,
      createdAt: '2026-10-09T08:30:00.000Z',
    });
  });
});

describe('NotificationsService.compteurNonLues', () => {
  it('ne compte que les non lues du destinataire', async () => {
    const { service, prisma } = creer();
    expect(await service.compteurNonLues(USER)).toEqual({ nonLues: 3 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { utilisateurId: USER, lueLe: null },
    });
  });
});

describe('NotificationsService.marquerLue / marquerNonLue', () => {
  it('marque lue seulement si elle ne l’est pas (la date d’origine est conservée)', async () => {
    const { service, prisma } = creer();
    await service.marquerLue(USER, NOTIF);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: NOTIF, utilisateurId: USER, lueLe: null },
      data: { lueLe: expect.any(Date) },
    });
  });

  it('est idempotent : déjà lue → 200 avec la notification, pas d’erreur', async () => {
    const { service, prisma } = creer();
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue({
      ...brute,
      lueLe: new Date('2026-10-09T09:00:00Z'),
    });
    const res = await service.marquerLue(USER, NOTIF);
    expect(res).toMatchObject({ lue: true, lueLe: '2026-10-09T09:00:00.000Z' });
  });

  it('marque non lue', async () => {
    const { service, prisma } = creer();
    await service.marquerNonLue(USER, NOTIF);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: NOTIF, utilisateurId: USER, lueLe: { not: null } },
      data: { lueLe: null },
    });
  });

  it('404 « Notification introuvable. » pour un id inconnu ou d’un collègue', async () => {
    const { service, prisma } = creer();
    prisma.notification.findFirst.mockResolvedValue(null);
    await expect(service.marquerLue(USER, NOTIF)).rejects.toThrow(
      new NotFoundException('Notification introuvable.'),
    );
    await expect(service.marquerNonLue(USER, NOTIF)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: NOTIF, utilisateurId: USER },
    });
  });
});

describe('NotificationsService.toutLire', () => {
  it('ne touche que les non lues du destinataire et renvoie le nombre', async () => {
    const { service, prisma } = creer();
    prisma.notification.updateMany.mockResolvedValue({ count: 4 });
    expect(await service.toutLire(USER)).toEqual({ marquees: 4 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { utilisateurId: USER, lueLe: null },
      data: { lueLe: expect.any(Date) },
    });
  });
});

describe('NotificationsService.supprimer', () => {
  it('supprime en bornant au destinataire', async () => {
    const { service, prisma } = creer();
    await service.supprimer(USER, NOTIF);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: NOTIF, utilisateurId: USER },
    });
  });

  it('404 quand rien n’est supprimé', async () => {
    const { service, prisma } = creer();
    prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.supprimer(USER, NOTIF)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('NotificationsService — production', () => {
  const doc = {
    etablissementId: ETAB,
    auteurId: USER,
    documentId: 'doc-1',
    typeDocumentNom: 'Certificat de scolarité',
    eleveNomComplet: 'Adjovi Akpovi',
  };

  it('document établi : collègues actifs avec la préférence, auteur exclu', async () => {
    const { service, prisma } = creer();
    await service.documentEtabli(doc);

    expect(prisma.utilisateur.findMany.mock.calls[0]![0].where).toEqual({
      etablissementId: ETAB,
      id: { not: USER },
      actif: true,
      emailVerifieLe: { not: null },
      notifDocumentGenere: true,
    });
    const { data } = prisma.notification.createMany.mock.calls[0]![0];
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({
      type: 'DOCUMENT_ETABLI',
      categorie: 'DOCUMENTS',
      titre: 'Document établi',
      message: 'Certificat de scolarité pour Adjovi Akpovi.',
      documentId: 'doc-1',
      etablissementId: ETAB,
      utilisateurId: 'u2',
    });
  });

  it('document annulé : aucune préférence à respecter', async () => {
    const { service, prisma } = creer();
    await service.documentAnnule(doc);
    expect(
      prisma.utilisateur.findMany.mock.calls[0]![0].where,
    ).not.toHaveProperty('notifDocumentGenere');
    expect(
      prisma.notification.createMany.mock.calls[0]![0].data[0],
    ).toMatchObject({
      type: 'DOCUMENT_ANNULE',
      titre: 'Document annulé',
    });
  });

  it('invitation acceptée : Directeurs seulement, avec la préférence', async () => {
    const { service, prisma } = creer();
    await service.invitationAcceptee({
      etablissementId: ETAB,
      membreId: 'm1',
      membreLibelle: 'Mireille Ahouandjinou',
      fonction: 'Secrétaire',
    });
    expect(prisma.utilisateur.findMany.mock.calls[0]![0].where).toMatchObject({
      role: 'DIRECTEUR',
      id: { not: 'm1' },
      notifInvitationAcceptee: true,
    });
    expect(
      prisma.notification.createMany.mock.calls[0]![0].data[0],
    ).toMatchObject({
      type: 'INVITATION_ACCEPTEE',
      categorie: 'EQUIPE',
      membreId: 'm1',
      message: "Mireille Ahouandjinou a rejoint l'équipe (Secrétaire).",
    });
  });

  it('ne crée rien (et ne plante pas) sans destinataire', async () => {
    const { service, prisma } = creer();
    prisma.utilisateur.findMany.mockResolvedValue([]);
    await service.documentEtabli(doc);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('ne lève JAMAIS : une panne de base ne doit pas faire échouer l’action métier', async () => {
    const { service, prisma } = creer();
    prisma.notification.createMany.mockRejectedValue(new Error('panne'));
    await expect(service.documentEtabli(doc)).resolves.toBeUndefined();
    prisma.utilisateur.findMany.mockRejectedValue(new Error('panne'));
    await expect(service.documentAnnule(doc)).resolves.toBeUndefined();
  });
});
