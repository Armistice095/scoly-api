import { HttpException } from '@nestjs/common';
import { JournalVerificationService } from './journal-verification.service.js';
import { ECHECS_SAISIE_MAX, RETENTION_JOURNAL_JOURS } from './constantes.js';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));

const SECRET = 'un-secret-de-test-assez-long';
/** `null` = variable absente (un `undefined` déclencherait la valeur par défaut). */
const config = (valeur: string | null = SECRET, nodeEnv = 'test') =>
  ({
    get: (cle: string) =>
      cle === 'NODE_ENV' ? nodeEnv : (valeur ?? undefined),
  }) as never;

function creer() {
  const prisma = {
    journalVerification: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  return {
    prisma,
    journal: new JournalVerificationService(prisma as never, config()),
  };
}

describe('hacherIp', () => {
  const jour1 = new Date('2026-10-05T10:00:00Z');
  const jour2 = new Date('2026-10-06T10:00:00Z');

  it('est déterministe et ne contient pas l’IP', () => {
    const { journal } = creer();
    const h = journal.hacherIp('41.74.12.9', jour1);
    expect(h).toBe(journal.hacherIp('41.74.12.9', jour1));
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain('41');
  });

  it('distingue deux IP', () => {
    const { journal } = creer();
    expect(journal.hacherIp('41.74.12.9', jour1)).not.toBe(
      journal.hacherIp('41.74.12.10', jour1),
    );
  });

  it('change chaque jour : pas de suivi d’un visiteur au long terme', () => {
    const { journal } = creer();
    expect(journal.hacherIp('41.74.12.9', jour1)).not.toBe(
      journal.hacherIp('41.74.12.9', jour2),
    );
  });

  it('dépend du secret', () => {
    const { prisma } = creer();
    const autre = new JournalVerificationService(
      prisma as never,
      config('un-autre-secret-de-test'),
    );
    expect(autre.hacherIp('41.74.12.9', jour1)).not.toBe(
      creer().journal.hacherIp('41.74.12.9', jour1),
    );
  });

  it('regroupe un /64 IPv6 et unifie IPv4 mappée', () => {
    const { journal } = creer();
    expect(journal.hacherIp('2001:db8:1:2:aaaa::1', jour1)).toBe(
      journal.hacherIp('2001:db8:1:2:bbbb::9', jour1),
    );
    expect(journal.hacherIp('2001:db8:1:3::1', jour1)).not.toBe(
      journal.hacherIp('2001:db8:1:2::1', jour1),
    );
    expect(journal.hacherIp('::ffff:41.74.12.9', jour1)).toBe(
      journal.hacherIp('41.74.12.9', jour1),
    );
  });

  it('tolère une IP absente', () => {
    expect(creer().journal.hacherIp(undefined, jour1)).toMatch(
      /^[0-9a-f]{32}$/,
    );
  });
});

describe('secret', () => {
  it('absent ou trop court en production → refus de démarrer', () => {
    expect(
      () =>
        new JournalVerificationService({} as never, config(null, 'production')),
    ).toThrow(/VERIFICATION_LOG_SECRET/);
    expect(
      () =>
        new JournalVerificationService(
          {} as never,
          config('court', 'production'),
        ),
    ).toThrow(/VERIFICATION_LOG_SECRET/);
    expect(
      () =>
        new JournalVerificationService(
          {} as never,
          config(SECRET, 'production'),
        ),
    ).not.toThrow();
  });
  it('absent hors production → secret de développement', () => {
    expect(
      () => new JournalVerificationService({} as never, config(null)),
    ).not.toThrow();
  });
});

describe('refuserSiTropDEchecs', () => {
  it('laisse passer sous le seuil, en ne comptant que les échecs de saisie récents de cette IP', async () => {
    const { journal, prisma } = creer();
    prisma.journalVerification.count.mockResolvedValue(ECHECS_SAISIE_MAX - 1);
    await expect(journal.refuserSiTropDEchecs('h')).resolves.toBeUndefined();
    const { where } = prisma.journalVerification.count.mock.calls[0]![0];
    expect(where).toMatchObject({
      ipHash: 'h',
      canal: 'SAISIE',
      resultat: { in: ['INTROUVABLE', 'AMBIGU'] },
    });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it('429 TROP_DE_REQUETES au seuil, avec retryAfterSecondes', async () => {
    const { journal, prisma } = creer();
    prisma.journalVerification.count.mockResolvedValue(ECHECS_SAISIE_MAX);
    const erreur = (await journal
      .refuserSiTropDEchecs('h')
      .catch((e: unknown) => e)) as HttpException;
    expect(erreur).toBeInstanceOf(HttpException);
    expect(erreur.getStatus()).toBe(429);
    expect(erreur.getResponse()).toMatchObject({
      statusCode: 429,
      code: 'TROP_DE_REQUETES',
      retryAfterSecondes: 600,
    });
  });
});

describe('enregistrer', () => {
  it('écrit exactement canal, résultat, ipHash, documentId — rien d’autre', async () => {
    const { journal, prisma } = creer();
    await journal.enregistrer({
      canal: 'SAISIE',
      resultat: 'INTROUVABLE',
      ipHash: 'h',
      documentId: null,
    });
    expect(prisma.journalVerification.create).toHaveBeenCalledWith({
      data: {
        canal: 'SAISIE',
        resultat: 'INTROUVABLE',
        ipHash: 'h',
        documentId: null,
      },
    });
  });

  it('n’échoue jamais et ne journalise aucune valeur de l’erreur', async () => {
    const { journal, prisma } = creer();
    const warn = vi
      .spyOn((journal as any).logger, 'warn')
      .mockImplementation(() => {});
    prisma.journalVerification.create.mockRejectedValue(
      new Error('Unique constraint failed on N°0042/2025-2026/CEG-GODOMEY'),
    );
    await expect(
      journal.enregistrer({
        canal: 'QR',
        resultat: 'VALIDE',
        ipHash: 'h',
        documentId: 'd',
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).not.toContain('N°0042');
  });

  it('purge les lignes de plus de 90 jours, au plus une fois par heure', async () => {
    const { journal, prisma } = creer();
    const e = {
      canal: 'QR',
      resultat: 'VALIDE',
      ipHash: 'h',
      documentId: null,
    } as const;
    await journal.enregistrer(e);
    await journal.enregistrer(e);
    expect(prisma.journalVerification.deleteMany).toHaveBeenCalledTimes(1);
    const limite: Date =
      prisma.journalVerification.deleteMany.mock.calls[0]![0].where.createdAt
        .lt;
    const ageJours = (Date.now() - limite.getTime()) / 86_400_000;
    expect(Math.round(ageJours)).toBe(RETENTION_JOURNAL_JOURS);
  });
});
