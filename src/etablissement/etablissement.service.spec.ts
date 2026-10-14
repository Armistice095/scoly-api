import { ConflictException } from '@nestjs/common';
import { EtablissementService } from './etablissement.service.js';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('../storage/storage.service.js', () => ({ StorageService: class {} }));

const ETAB = 'etab-1';

function creer(
  opts: { format?: string | null; compteur?: number; max?: number | null } = {},
) {
  const { format = 'N°{N}/{ANNEE}', compteur = 25, max = 24 } = opts;
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    etablissement: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        formatReference: format,
        prochainNumero: compteur,
        anneeScolaireActive: { libelle: '2025-2026' },
      }),
      update: vi.fn().mockResolvedValue({
        id: ETAB,
        logoChemin: null,
        signatureChemin: null,
        cachetChemin: null,
        anneeScolaireActive: null,
      }),
    },
    document: {
      aggregate: vi.fn().mockResolvedValue({ _max: { numeroOrdre: max } }),
    },
  };
  const prisma = {
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    etablissement: { update: tx.etablissement.update },
  };
  const service = new EtablissementService(prisma as never, {} as never);
  return { service, prisma, tx };
}

describe('EtablissementService.mettreAJour — numérotation', () => {
  it('une mise à jour sans rapport avec la numérotation reste simple (pas de verrou, pas de calcul)', async () => {
    const { service, prisma, tx } = creer();
    await service.mettreAJour(ETAB, { devise: 'Travail' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.document.aggregate).not.toHaveBeenCalled();
    expect(tx.etablissement.update).toHaveBeenCalledOnce();
  });

  it('refuse un prochain numéro déjà attribué (409) et indique le minimum', async () => {
    const { service, tx } = creer({ max: 24 });

    await expect(
      service.mettreAJour(ETAB, { prochainNumero: 10 }),
    ).rejects.toMatchObject({
      response: {
        code: 'PROCHAIN_NUMERO_TROP_BAS',
        prochainNumeroMinimum: 25,
      },
    });
    expect(tx.etablissement.update).not.toHaveBeenCalled();
  });

  it('refuse aussi le numéro du dernier document émis (même annulé)', async () => {
    const { service } = creer({ max: 24 });
    await expect(
      service.mettreAJour(ETAB, { prochainNumero: 24 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepte exactement le plancher et toute valeur au-dessus', async () => {
    const { service, tx } = creer({ max: 24 });
    await service.mettreAJour(ETAB, { prochainNumero: 25 });
    await service.mettreAJour(ETAB, { prochainNumero: 100 });
    expect(tx.etablissement.update).toHaveBeenCalledTimes(2);
  });

  it('verrouille la ligne de l’établissement avant de lire le plus grand numéro', async () => {
    const { service, tx } = creer();
    await service.mettreAJour(ETAB, { prochainNumero: 30 });

    const ordre = [
      tx.$queryRaw.mock.invocationCallOrder[0]!,
      tx.document.aggregate.mock.invocationCallOrder[0]!,
      tx.etablissement.update.mock.invocationCallOrder[0]!,
    ];
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it('un changement de FORMAT seul est aussi contrôlé contre le compteur actuel', async () => {
    // Passer à un format sans année : la numérotation devient continue, le
    // compteur de l'année en cours (3) retomberait sous les numéros déjà émis.
    const { service, tx } = creer({ compteur: 3, max: 40 });

    await expect(
      service.mettreAJour(ETAB, { formatReference: 'N°{N}/CEG' }),
    ).rejects.toMatchObject({
      response: { prochainNumeroMinimum: 41 },
    });
    expect(tx.etablissement.update).not.toHaveBeenCalled();
  });

  it('un changement de format cohérent avec le compteur passe', async () => {
    const { service, tx } = creer({ compteur: 25, max: 24 });
    await service.mettreAJour(ETAB, { formatReference: 'N°{N}/{ANNEE}/CEG' });
    expect(tx.etablissement.update).toHaveBeenCalledOnce();
  });

  it('utilise le NOUVEAU format pour décider si l’année compte', async () => {
    const { service, tx } = creer({
      format: 'N°{N}/{ANNEE}',
      compteur: 5,
      max: 4,
    });
    await service.mettreAJour(ETAB, {
      formatReference: 'N°{N}/{ANNEE}/CEG',
      prochainNumero: 5,
    });

    const { where } = tx.document.aggregate.mock.calls[0]![0];
    expect(where.donneesFigees).toEqual({
      path: ['anneeScolaire'],
      equals: '2025-2026',
    });
  });
});

describe('EtablissementService.mettreAJour — en-tête automatique', () => {
  function creerAvecEntete(actuel: Record<string, unknown>) {
    const update = vi.fn().mockResolvedValue({
      id: ETAB,
      logoChemin: null,
      signatureChemin: null,
      cachetChemin: null,
      anneeScolaireActive: null,
    });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(actuel);
    const prisma = { etablissement: { update, findUniqueOrThrow } };
    return {
      service: new EtablissementService(prisma as never, {} as never),
      update,
      findUniqueOrThrow,
    };
  }

  const auto = {
    ordreEnseignement: 'PRIMAIRE',
    departement: 'Couffo',
    ministereTutelle: 'Ministère des Enseignements Maternel et Primaire (MEMP)',
    directionDepartementale:
      'Direction Départementale des Enseignements Maternel et Primaire du Couffo (DDEMP-COUFFO)',
    devise: 'Fraternité - Justice - Travail',
  };

  it('un changement de département recale la direction automatique', async () => {
    const { service, update } = creerAvecEntete(auto);
    await service.mettreAJour(ETAB, { departement: 'Mono' });

    expect(update.mock.calls[0][0].data).toMatchObject({
      departement: 'Mono',
      directionDepartementale:
        'Direction Départementale des Enseignements Maternel et Primaire du Mono (DDEMP-MONO)',
    });
  });

  it('conserve la direction personnalisée', async () => {
    const { service, update } = creerAvecEntete({
      ...auto,
      directionDepartementale: 'Intitulé personnalisé',
    });
    await service.mettreAJour(ETAB, { departement: 'Mono' });

    expect(update.mock.calls[0][0].data).not.toHaveProperty(
      'directionDepartementale',
    );
  });

  it('ne lit pas l’établissement si ni ordre ni département ne sont touchés', async () => {
    const { service, findUniqueOrThrow, update } = creerAvecEntete(auto);
    await service.mettreAJour(ETAB, { devise: 'Travail' });

    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0].data).toEqual({ devise: 'Travail' });
  });
});
