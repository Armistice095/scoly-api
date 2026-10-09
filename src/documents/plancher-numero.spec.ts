import { plancherProchainNumero } from './plancher-numero.js';

const ETAB = 'etab-1';

function db(max: number | null) {
  const aggregate = vi.fn().mockResolvedValue({ _max: { numeroOrdre: max } });
  return { db: { document: { aggregate } } as never, aggregate };
}

describe('plancherProchainNumero', () => {
  it('vaut 1 quand aucun document n’a été émis', async () => {
    const { db: base } = db(null);
    expect(
      await plancherProchainNumero(base, ETAB, 'N°{N}/{ANNEE}', '2025-2026'),
    ).toBe(1);
  });

  it('vaut le plus grand numéro émis + 1', async () => {
    const { db: base } = db(24);
    expect(
      await plancherProchainNumero(base, ETAB, 'N°{N}/{ANNEE}', '2025-2026'),
    ).toBe(25);
  });

  it('format avec {ANNEE} : ne regarde que les documents de cette année scolaire', async () => {
    const { db: base, aggregate } = db(3);
    await plancherProchainNumero(base, ETAB, 'N°{N}/{ANNEE}', '2026-2027');

    expect(aggregate).toHaveBeenCalledWith({
      where: {
        etablissementId: ETAB,
        numeroOrdre: { not: null },
        donneesFigees: { path: ['anneeScolaire'], equals: '2026-2027' },
      },
      _max: { numeroOrdre: true },
    });
  });

  it('format sans année : la numérotation est continue, tous les documents comptent', async () => {
    const { db: base, aggregate } = db(40);
    expect(await plancherProchainNumero(base, ETAB, 'N°{N}', '2026-2027')).toBe(
      41,
    );

    const { where } = aggregate.mock.calls[0]![0];
    expect(where).toEqual({
      etablissementId: ETAB,
      numeroOrdre: { not: null },
    });
  });

  it('format par défaut (sans format enregistré) : repart chaque année', async () => {
    const { db: base, aggregate } = db(null);
    await plancherProchainNumero(base, ETAB, null, '2025-2026');
    expect(aggregate.mock.calls[0]![0].where.donneesFigees).toBeDefined();
  });

  it('format par année mais aucune année active : 1, sans interroger la base', async () => {
    const { db: base, aggregate } = db(9);
    expect(
      await plancherProchainNumero(base, ETAB, 'N°{N}/{ANNEE}', null),
    ).toBe(1);
    expect(aggregate).not.toHaveBeenCalled();
  });
});
