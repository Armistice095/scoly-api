import { ConflictException, NotFoundException } from '@nestjs/common';
import { ElevesService } from './eleves.service.js';
import type { CreerEleveDto } from './dto/creer-eleve.dto.js';
import type { ModifierEleveDto } from './dto/modifier-eleve.dto.js';
import type { ListerElevesQueryDto } from './dto/lister-eleves-query.dto.js';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));

vi.mock('@prisma/client', () => ({
  Sexe: { MASCULIN: 'MASCULIN', FEMININ: 'FEMININ' },
  StatutEleve: { ACTIF: 'ACTIF' },
}));

const ETAB = 'etab-1';

const eleveEnBase = {
  id: 'eleve-1',
  etablissementId: ETAB,
  matricule: 'CEG-0007',
  matriculeEducMaster: null,
  nom: 'ADJAHO',
  prenoms: 'Nadège',
  sexe: 'FEMININ',
  dateNaissance: new Date('2014-07-15T00:00:00Z'),
  lieuNaissance: 'Cotonou',
  parentTuteur: 'M. Basile Hounkpatin',
  telephone: '+2290197164676',
  adresse: null,
  classe: null,
  dateInscription: null,
  statut: 'ACTIF',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function creerService() {
  const eleve = {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi
      .fn()
      .mockImplementation(({ data }) =>
        Promise.resolve({ ...eleveEnBase, ...data }),
      ),
    // Comme Prisma : une clé à `undefined` est ignorée (colonne inchangée).
    update: vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...eleveEnBase,
        ...Object.fromEntries(
          Object.entries(data).filter(([, valeur]) => valeur !== undefined),
        ),
      }),
    ),
  };
  const prisma = {
    eleve,
    $transaction: vi.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  return { service: new ElevesService(prisma as never), eleve };
}

const dtoCreation = {
  nom: 'ADJAHO',
  prenoms: 'Nadège',
  sexe: 'FEMININ',
  dateNaissance: '2014-07-15',
  lieuNaissance: 'Cotonou',
  parentTuteur: 'M. Basile Hounkpatin',
  telephone: '+2290197164676',
} as CreerEleveDto;

describe('ElevesService.lister', () => {
  it('filtre toujours par établissement et pagine', async () => {
    const { service, eleve } = creerService();
    eleve.count.mockResolvedValue(30);
    eleve.findMany.mockResolvedValue([eleveEnBase]);

    const res = await service.lister(ETAB, {
      page: 2,
      limit: 10,
    } as ListerElevesQueryDto);

    expect(eleve.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { etablissementId: ETAB },
        skip: 10,
        take: 10,
        orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(res.meta).toEqual({ total: 30, page: 2, limit: 10, totalPages: 3 });
    expect(res.data[0]?.dateNaissance).toBe('2014-07-15');
  });

  it('cherche chaque mot dans le texte normalisé, sans accents ni casse', async () => {
    const { service, eleve } = creerService();
    await service.lister(ETAB, {
      search: ' ADJAHO  Nadège ',
      page: 1,
      limit: 10,
    } as ListerElevesQueryDto);

    const { where } = eleve.findMany.mock.calls[0]![0];
    expect(where.etablissementId).toBe(ETAB);
    expect(where.AND).toEqual([
      { rechercheNormalisee: { contains: 'adjaho' } },
      { rechercheNormalisee: { contains: 'nadege' } },
    ]);
  });

  it('ignore une recherche vide ou ne contenant que des séparateurs', async () => {
    const { service, eleve } = creerService();
    await service.lister(ETAB, {
      search: ' - ',
      page: 1,
      limit: 10,
    } as ListerElevesQueryDto);
    expect(eleve.findMany.mock.calls[0]![0].where).toEqual({
      etablissementId: ETAB,
    });
  });
});

describe('ElevesService.recuperer', () => {
  it('renvoie 404 pour un élève d’un autre établissement', async () => {
    const { service, eleve } = creerService();
    await expect(service.recuperer(ETAB, 'eleve-autre')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(eleve.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'eleve-autre', etablissementId: ETAB },
      }),
    );
  });

  it('inclut les documents établis', async () => {
    const { service, eleve } = creerService();
    eleve.findFirst.mockResolvedValue({
      ...eleveEnBase,
      documents: [{ id: 'd1' }],
    });
    const res = await service.recuperer(ETAB, 'eleve-1');
    expect(res.documents).toEqual([{ id: 'd1' }]);
  });
});

describe('ElevesService.creer', () => {
  it('crée l’élève rattaché à l’établissement du JWT', async () => {
    const { service, eleve } = creerService();
    await service.creer(ETAB, dtoCreation);
    const { data } = eleve.create.mock.calls[0]![0];
    expect(data.etablissementId).toBe(ETAB);
    expect(data.dateNaissance).toEqual(new Date('2014-07-15T00:00:00.000Z'));
    expect(data.matricule).toBeNull();
    expect(data).not.toHaveProperty('confirmerDoublon');
    expect(data).not.toHaveProperty('statut');
    expect(data.rechercheNormalisee).toBe('adjaho nadege');
  });

  it('refuse un matricule déjà utilisé (insensible à la casse)', async () => {
    const { service, eleve } = creerService();
    eleve.findMany.mockResolvedValue([
      { matricule: 'ceg-0007', matriculeEducMaster: null },
    ]);
    await expect(
      service.creer(ETAB, { ...dtoCreation, matricule: 'CEG-0007' }),
    ).rejects.toMatchObject({ response: { code: 'MATRICULE_DEJA_UTILISE' } });
    expect(eleve.create).not.toHaveBeenCalled();
  });

  it('signale un doublon possible, sauf confirmation explicite', async () => {
    const { service, eleve } = creerService();
    eleve.findFirst.mockResolvedValue({ id: 'autre' });

    await expect(service.creer(ETAB, dtoCreation)).rejects.toMatchObject({
      response: { code: 'ELEVE_DOUBLON_POSSIBLE' },
    });

    await service.creer(ETAB, { ...dtoCreation, confirmerDoublon: true });
    expect(eleve.create).toHaveBeenCalledTimes(1);
  });

  it('traduit une violation d’unicité concurrente (P2002) en 409', async () => {
    const { service, eleve } = creerService();
    eleve.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.creer(ETAB, dtoCreation)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('ElevesService.modifier', () => {
  it('renvoie 404 si l’élève n’appartient pas à l’établissement', async () => {
    const { service, eleve } = creerService();
    await expect(
      service.modifier(ETAB, 'x', {
        lieuNaissance: 'Ouidah',
      } as ModifierEleveDto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(eleve.update).not.toHaveBeenCalled();
  });

  it('n’écrit que les champs envoyés et exclut l’élève lui-même des contrôles', async () => {
    const { service, eleve } = creerService();
    eleve.findFirst.mockResolvedValue(eleveEnBase);

    await service.modifier(ETAB, 'eleve-1', {
      matricule: 'CEG-0007',
      adresse: null,
    } as ModifierEleveDto);

    const requeteUnicite = eleve.findMany.mock.calls[0]![0];
    expect(requeteUnicite.where.id).toEqual({ not: 'eleve-1' });

    const { data, where } = eleve.update.mock.calls[0]![0];
    expect(where).toEqual({ id: 'eleve-1' });
    expect(data.adresse).toBeNull();
    expect(data.nom).toBeUndefined();
    // Recalculé à partir des valeurs fusionnées (nouveau matricule + identité en base).
    expect(data.rechercheNormalisee).toBe('adjaho nadege ceg 0007');
    expect(data).not.toHaveProperty('etablissementId');
  });

  it('recalcule le texte de recherche quand le nom change, et retire un matricule effacé', async () => {
    const { service, eleve } = creerService();
    eleve.findFirst.mockResolvedValue(eleveEnBase);

    await service.modifier(ETAB, 'eleve-1', {
      prenoms: 'Sènami',
      matricule: null,
      confirmerDoublon: true,
    } as ModifierEleveDto);

    expect(eleve.update.mock.calls[0]![0].data.rechercheNormalisee).toBe(
      'adjaho senami',
    );
  });

  it('recontrôle le doublon avec les valeurs fusionnées quand l’identité change', async () => {
    const { service, eleve } = creerService();
    eleve.findFirst
      .mockResolvedValueOnce(eleveEnBase) // trouverOuEchouer
      .mockResolvedValueOnce({ id: 'autre' }); // homonyme

    await expect(
      service.modifier(ETAB, 'eleve-1', {
        dateNaissance: '2013-01-01',
      } as ModifierEleveDto),
    ).rejects.toMatchObject({ response: { code: 'ELEVE_DOUBLON_POSSIBLE' } });

    const requeteDoublon = eleve.findFirst.mock.calls[1]![0];
    expect(requeteDoublon.where.nom.equals).toBe('ADJAHO');
    expect(requeteDoublon.where.id).toEqual({ not: 'eleve-1' });
  });
});

describe('ElevesService — classe et date d’inscription', () => {
  it('crée l’élève avec classe et date d’inscription, et les indexe pour la recherche', async () => {
    const { service, eleve } = creerService();
    await service.creer(ETAB, {
      ...dtoCreation,
      classe: 'CE1',
      dateInscription: '2023-06-22',
    });
    const { data } = eleve.create.mock.calls[0]![0];
    expect(data.classe).toBe('CE1');
    expect(data.dateInscription).toEqual(new Date('2023-06-22T00:00:00.000Z'));
    expect(data.rechercheNormalisee).toBe('adjaho nadege ce1');
  });

  it('les laisse vides par défaut', async () => {
    const { service, eleve } = creerService();
    await service.creer(ETAB, dtoCreation);
    const { data } = eleve.create.mock.calls[0]![0];
    expect(data.classe).toBeNull();
    expect(data.dateInscription).toBeNull();
  });

  it('modifier : recalcule la recherche avec la nouvelle classe', async () => {
    const { service, eleve } = creerService();
    eleve.findFirst.mockResolvedValue(eleveEnBase);
    await service.modifier(ETAB, 'eleve-1', {
      classe: '3ème A',
    } as ModifierEleveDto);
    expect(eleve.update.mock.calls[0]![0].data.rechercheNormalisee).toBe(
      'adjaho nadege ceg 0007 3eme a',
    );
  });

  it('modifier : null efface la date d’inscription', async () => {
    const { service, eleve } = creerService();
    eleve.findFirst.mockResolvedValue({
      ...eleveEnBase,
      dateInscription: new Date('2023-06-22'),
    });
    await service.modifier(ETAB, 'eleve-1', {
      dateInscription: null,
    } as ModifierEleveDto);
    expect(eleve.update.mock.calls[0]![0].data.dateInscription).toBeNull();
  });

  it('modifier : refuse une naissance postérieure à l’inscription déjà enregistrée', async () => {
    const { service, eleve } = creerService();
    eleve.findFirst.mockResolvedValue({
      ...eleveEnBase,
      dateInscription: new Date('2023-06-22'),
    });
    await expect(
      service.modifier(ETAB, 'eleve-1', {
        dateNaissance: '2024-01-01',
      } as ModifierEleveDto),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        erreurs: [{ champ: 'dateInscription' }],
      },
    });
    expect(eleve.update).not.toHaveBeenCalled();
  });

  it('lister : la classe est cherchable (« ce1 »)', async () => {
    const { service, eleve } = creerService();
    await service.lister(ETAB, {
      search: 'CE1',
      page: 1,
      limit: 10,
    } as ListerElevesQueryDto);
    expect(eleve.findMany.mock.calls[0]![0].where.AND).toEqual([
      { rechercheNormalisee: { contains: 'ce1' } },
    ]);
  });
});
