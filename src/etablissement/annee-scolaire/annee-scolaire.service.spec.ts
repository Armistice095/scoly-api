import { AnneeScolaireService } from './annee-scolaire.service.js';

vi.mock('../../prisma/prisma.service.js', () => ({ PrismaService: class {} }));

const ETAB = 'etab-1';

function creer(opts: { format: string | null; max: number | null }) {
  const tx = {
    anneeScolaire: {
      create: vi.fn().mockResolvedValue({ id: 'a2', libelle: '2026-2027' }),
    },
    etablissement: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ formatReference: opts.format }),
      update: vi.fn().mockResolvedValue({}),
    },
    document: {
      aggregate: vi.fn().mockResolvedValue({ _max: { numeroOrdre: opts.max } }),
    },
  };
  const prisma = {
    anneeScolaire: {
      findFirst: vi.fn().mockResolvedValue({ id: 'a1', libelle: '2025-2026' }),
    },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new AnneeScolaireService(prisma as never), tx };
}

const dto = {
  libelle: '2026-2027',
  dateRentree: '2026-09-15',
  dateFin: '2027-07-10',
};

describe('AnneeScolaireService — numérotation', () => {
  it('nouvelle année + format avec {ANNEE} : la numérotation repart de 1', async () => {
    const { service, tx } = creer({ format: 'N°{N}/{ANNEE}', max: null });
    await service.creer(ETAB, dto);
    expect(tx.etablissement.update.mock.calls[0]![0].data).toEqual({
      anneeScolaireActiveId: 'a2',
      prochainNumero: 1,
    });
  });

  it('nouvelle année au libellé déjà utilisé : reprend après le dernier numéro, ne redonne rien', async () => {
    const { service, tx } = creer({ format: 'N°{N}/{ANNEE}', max: 12 });
    await service.creer(ETAB, dto);
    expect(tx.etablissement.update.mock.calls[0]![0].data.prochainNumero).toBe(
      13,
    );
  });

  it('nouvelle année + format sans année : le compteur n’est pas touché', async () => {
    const { service, tx } = creer({ format: 'N°{N}', max: 40 });
    await service.creer(ETAB, dto);
    expect(tx.etablissement.update.mock.calls[0]![0].data).toEqual({
      anneeScolaireActiveId: 'a2',
    });
  });

  it('réactiver une ancienne année reprend après son dernier numéro (jamais le compteur de l’autre année)', async () => {
    const { service, tx } = creer({ format: 'N°{N}/{ANNEE}', max: 40 });
    await service.activer(ETAB, 'a1');

    expect(tx.document.aggregate.mock.calls[0]![0].where.donneesFigees).toEqual(
      {
        path: ['anneeScolaire'],
        equals: '2025-2026',
      },
    );
    expect(tx.etablissement.update.mock.calls[0]![0].data).toEqual({
      anneeScolaireActiveId: 'a1',
      prochainNumero: 41,
    });
  });

  it('réactiver avec un format sans année : seul l’année active change', async () => {
    const { service, tx } = creer({ format: 'N°{N}', max: 40 });
    await service.activer(ETAB, 'a1');
    expect(tx.etablissement.update.mock.calls[0]![0].data).toEqual({
      anneeScolaireActiveId: 'a1',
    });
  });
});
