import { VerificationDocumentService } from './verification-document.service.js';
import type { JournalVerificationService } from './journal-verification.service.js';
import {
  documentAnnule,
  documentBrut,
  TOKEN,
} from '../../test/fixtures/verification-document.js';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));

const REF = 'N°0042/2025-2026/CEG-GODOMEY';

function creer() {
  const prisma = {
    document: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const journal = {
    hacherIp: vi.fn().mockReturnValue('hash-ip'),
    refuserSiTropDEchecs: vi.fn().mockResolvedValue(undefined),
    enregistrer: vi.fn().mockResolvedValue(undefined),
  };
  const service = new VerificationDocumentService(
    prisma as never,
    journal as unknown as JournalVerificationService,
  );
  return { service, prisma, journal };
}

describe('VerificationDocumentService — canal QR', () => {
  it('document actif → VALIDE, journalisé avec son id', async () => {
    const { service, prisma, journal } = creer();
    prisma.document.findUnique.mockResolvedValue(documentBrut());

    const r = await service.verifier({ token: TOKEN }, '41.0.0.1');

    expect(r.resultat).toBe('VALIDE');
    expect(prisma.document.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { qrCodeToken: TOKEN } }),
    );
    expect(journal.enregistrer).toHaveBeenCalledWith({
      canal: 'QR',
      resultat: 'VALIDE',
      ipHash: 'hash-ip',
      documentId: 'doc-uuid-interne',
    });
    expect(journal.refuserSiTropDEchecs).not.toHaveBeenCalled(); // pas de frein sur le QR
  });

  it('document annulé → ANNULE avec la date d’annulation', async () => {
    const { service, prisma } = creer();
    prisma.document.findUnique.mockResolvedValue(documentAnnule());
    const r = await service.verifier({ token: TOKEN }, undefined);
    expect(r.resultat).toBe('ANNULE');
    expect(r.document?.dateAnnulation).toBe('2026-10-01');
  });

  it('jeton inconnu → INTROUVABLE, sans document journalisé', async () => {
    const { service, journal } = creer();
    const r = await service.verifier({ token: TOKEN }, '41.0.0.1');
    expect(r).toMatchObject({
      resultat: 'INTROUVABLE',
      document: null,
      etablissement: null,
    });
    expect(journal.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({ resultat: 'INTROUVABLE', documentId: null }),
    );
  });

  it('jeton mal formé → INTROUVABLE sans AUCUNE requête SQL, indiscernable d’un jeton inconnu', async () => {
    const { service, prisma } = creer();
    const malForme = await service.verifier(
      { token: 'pas-un-jeton' },
      '41.0.0.1',
    );
    const inconnu = await service.verifier({ token: TOKEN }, '41.0.0.1');
    expect(prisma.document.findUnique).toHaveBeenCalledTimes(1); // seul le 2e a interrogé la base
    expect({ ...malForme, verifieLe: '' }).toEqual({
      ...inconnu,
      verifieLe: '',
    });
  });
});

describe('VerificationDocumentService — canal SAISIE', () => {
  it('une seule correspondance → VALIDE', async () => {
    const { service, prisma, journal } = creer();
    prisma.document.findMany.mockResolvedValue([documentBrut()]);

    const r = await service.verifier(
      { reference: ' n° 42/2025-2026/ceg godomey' },
      '41.0.0.1',
    );

    expect(r.resultat).toBe('VALIDE');
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { referenceNormalisee: '42 2025 2026 ceg godomey' },
      }),
    );
    expect(journal.refuserSiTropDEchecs).toHaveBeenCalledWith('hash-ip');
  });

  it('aucune correspondance → INTROUVABLE', async () => {
    const { service } = creer();
    expect(
      (await service.verifier({ reference: REF }, '41.0.0.1')).resultat,
    ).toBe('INTROUVABLE');
  });

  it('même référence dans deux écoles → AMBIGU, sans aucune donnée', async () => {
    const { service, prisma, journal } = creer();
    const autre = documentBrut({ id: 'autre-id' });
    autre.etablissement = { ...autre.etablissement, nom: 'Lycée Agbodjèdo' };
    prisma.document.findMany.mockResolvedValue([documentBrut(), autre]);

    const r = await service.verifier({ reference: REF }, '41.0.0.1');

    expect(r).toMatchObject({
      resultat: 'AMBIGU',
      document: null,
      etablissement: null,
    });
    expect(journal.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({ resultat: 'AMBIGU', documentId: null }),
    );
  });

  it('AMBIGU levé en précisant l’établissement', async () => {
    const { service, prisma } = creer();
    const autre = documentBrut({ id: 'autre-id' });
    autre.donneesFigees = {
      ...(autre.donneesFigees as object),
      etablissement: {
        ...(autre.donneesFigees as any).etablissement,
        nom: 'Lycée Agbodjèdo',
      },
    } as never;
    autre.etablissement = { ...autre.etablissement, nom: 'Lycée Agbodjèdo' };
    prisma.document.findMany.mockResolvedValue([documentBrut(), autre]);

    const r = await service.verifier(
      { reference: REF, etablissement: 'lycee agbodjedo' },
      '41.0.0.1',
    );

    expect(r.resultat).toBe('VALIDE');
    expect(r.etablissement?.nom).toBe('Lycée Agbodjèdo');
  });

  it('établissement fourni qui ne correspond à personne → INTROUVABLE (on ne confirme pas)', async () => {
    const { service, prisma } = creer();
    prisma.document.findMany.mockResolvedValue([documentBrut()]);
    const r = await service.verifier(
      { reference: REF, etablissement: 'Collège Inconnu' },
      '41.0.0.1',
    );
    expect(r.resultat).toBe('INTROUVABLE');
    expect(r.document).toBeNull();
  });

  it('établissement trop vague (plusieurs écoles encore) → toujours AMBIGU', async () => {
    const { service, prisma } = creer();
    const autre = documentBrut({ id: 'autre-id' });
    prisma.document.findMany.mockResolvedValue([documentBrut(), autre]);
    const r = await service.verifier(
      { reference: REF, etablissement: 'CEG' },
      '41.0.0.1',
    );
    expect(r.resultat).toBe('AMBIGU');
  });

  it('propage le refus du ralentissement progressif (429) AVANT toute lecture', async () => {
    const { service, prisma, journal } = creer();
    journal.refuserSiTropDEchecs.mockRejectedValue(new Error('429'));
    await expect(
      service.verifier({ reference: REF }, '41.0.0.1'),
    ).rejects.toThrow('429');
    expect(prisma.document.findMany).not.toHaveBeenCalled();
    expect(journal.enregistrer).not.toHaveBeenCalled();
  });
});

describe('VerificationDocumentService — robustesse', () => {
  it('une entrée invalide lève 400 sans toucher base ni journal', async () => {
    const { service, prisma, journal } = creer();
    await expect(service.verifier({}, '41.0.0.1')).rejects.toMatchObject({
      status: 400,
    });
    expect(prisma.document.findMany).not.toHaveBeenCalled();
    expect(journal.enregistrer).not.toHaveBeenCalled();
  });

  it('une panne du journal ne bloque pas la vérification', async () => {
    const { service, prisma, journal } = creer();
    prisma.document.findUnique.mockResolvedValue(documentBrut());
    journal.enregistrer.mockRejectedValue(
      new Error('base du journal indisponible'),
    );
    // enregistrer() réel ne rejette jamais ; même s'il le faisait, la réponse part avant.
    await expect(
      service.verifier({ token: TOKEN }, '41.0.0.1'),
    ).resolves.toMatchObject({
      resultat: 'VALIDE',
    });
  });

  it('l’heure vient du serveur, pas du client', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T17:47:00Z'));
    try {
      const { service, prisma } = creer();
      prisma.document.findUnique.mockResolvedValue(documentBrut());
      const r = await service.verifier(
        { token: TOKEN, verifieLe: '1999-01-01' } as never,
        undefined,
      );
      expect(r.verifieLe).toBe('2026-10-05T17:47:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });
});
