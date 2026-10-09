import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { ElevesImportService } from './eleves-import.service.js';
import { lireFichierExcel } from './lecture-excel.js';
import { genererModeleExcel } from './modele-excel.js';

vi.mock('../../prisma/prisma.service.js', () => ({ PrismaService: class {} }));

vi.mock('@prisma/client', () => ({
  Sexe: { MASCULIN: 'MASCULIN', FEMININ: 'FEMININ' },
  StatutEleve: { ACTIF: 'ACTIF' },
}));

const ENTETES = [
  'Matricule',
  'Matricule EducMaster',
  'Nom',
  'Prénoms',
  'Sexe',
  'Date de naissance',
  'Lieu de naissance',
  'Parent ou tuteur',
  'Téléphone',
  'Adresse',
];

async function fabriquerXlsx(
  lignes: (string | number | Date | null)[][],
  entetes = ENTETES,
) {
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('Élèves');
  feuille.addRow(entetes);
  lignes.forEach((l) => feuille.addRow(l));
  return Buffer.from(await classeur.xlsx.writeBuffer());
}

const ligneValide = (
  surcharge: Partial<Record<number, string | number | Date>> = {},
) => {
  const base: (string | number | Date | null)[] = [
    'CEG-0001',
    null,
    'Adjaho',
    'Nadège',
    'Féminin',
    new Date('2014-07-15T00:00:00Z'),
    'Cotonou',
    'M. Basile',
    '01 97 16 46 76',
    null,
  ];
  for (const [i, v] of Object.entries(surcharge)) base[Number(i)] = v as never;
  return base;
};

const fichier = (buffer: Buffer) => ({ buffer }) as Express.Multer.File;

function creerService(existants: unknown[] = []) {
  const eleve = {
    findMany: vi.fn().mockResolvedValue(existants),
    createMany: vi
      .fn()
      .mockImplementation(({ data }) =>
        Promise.resolve({ count: data.length }),
      ),
  };
  return { service: new ElevesImportService({ eleve } as never), eleve };
}

async function erreursDe(promesse: Promise<unknown>) {
  try {
    await promesse;
  } catch (e) {
    return (e as BadRequestException).getResponse() as {
      code: string;
      message: string;
      erreurs?: { ligne: number; messages: string[] }[];
    };
  }
  throw new Error('une erreur était attendue');
}

describe('lireFichierExcel', () => {
  it('lit les lignes, normalise date/sexe et ignore les lignes vides', async () => {
    const buffer = await fabriquerXlsx([
      ligneValide({ 4: 'F', 5: '15/07/2014' }),
      [],
      ligneValide({ 2: 'Agossou', 4: 'masculin' }),
    ]);
    const lignes = await lireFichierExcel(buffer);
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({
      ligne: 2,
      valeurs: { nom: 'Adjaho', sexe: 'FEMININ', dateNaissance: '2014-07-15' },
    });
    expect(lignes[1]).toMatchObject({
      ligne: 4,
      valeurs: { sexe: 'MASCULIN' },
    });
  });

  it('lit un téléphone saisi comme nombre', async () => {
    const lignes = await lireFichierExcel(
      await fabriquerXlsx([ligneValide({ 8: 197164676 })]),
    );
    expect(lignes[0]!.valeurs.telephone).toBe('197164676');
  });

  it('refuse un contenu qui n’est pas un .xlsx', async () => {
    const e = await erreursDe(
      lireFichierExcel(Buffer.from('nom;prenoms\nA;B')),
    );
    expect(e.code).toBe('FICHIER_INVALIDE');
  });

  it('liste les colonnes obligatoires manquantes', async () => {
    const buffer = await fabriquerXlsx([['A', 'B']], ['Nom', 'Prénoms']);
    const e = await erreursDe(lireFichierExcel(buffer));
    expect(e.code).toBe('COLONNES_MANQUANTES');
    expect(e.message).toMatch(/Sexe/);
    expect(e.message).toMatch(/Téléphone/);
  });

  it('refuse un fichier sans élève', async () => {
    const e = await erreursDe(lireFichierExcel(await fabriquerXlsx([])));
    expect(e.code).toBe('FICHIER_VIDE');
  });

  it('refuse plus de 500 lignes', async () => {
    const lignes = Array.from({ length: 501 }, (_, i) =>
      ligneValide({ 0: `M${i}`, 2: `N${i}` }),
    );
    const e = await erreursDe(lireFichierExcel(await fabriquerXlsx(lignes)));
    expect(e.code).toBe('TROP_DE_LIGNES');
  });

  it('relit le modèle généré (feuille Élèves vide → FICHIER_VIDE)', async () => {
    const e = await erreursDe(lireFichierExcel(await genererModeleExcel()));
    expect(e.code).toBe('FICHIER_VIDE');
  });
});

describe('ElevesImportService.importer', () => {
  it('importe toutes les lignes valides, rattachées à l’établissement', async () => {
    const { service, eleve } = creerService();
    const buffer = await fabriquerXlsx([
      ligneValide(),
      ligneValide({ 0: 'CEG-0002', 2: 'Agossou', 3: 'Yannick', 4: 'M' }),
    ]);

    const res = await service.importer('etab-1', fichier(buffer));

    expect(res).toEqual({ importes: 2 });
    const { data } = eleve.createMany.mock.calls[0]![0];
    expect(data).toHaveLength(2);
    expect(
      data.every(
        (d: { etablissementId: string }) => d.etablissementId === 'etab-1',
      ),
    ).toBe(true);
    expect(data[0].telephone).toBe('+2290197164676');
    expect(data[0].rechercheNormalisee).toBe('adjaho nadege ceg 0001');
    expect(data[0].dateNaissance).toEqual(new Date('2014-07-15T00:00:00.000Z'));
  });

  it('tout ou rien : une ligne invalide bloque l’import et toutes les erreurs sont listées', async () => {
    const { service, eleve } = creerService();
    const buffer = await fabriquerXlsx([
      ligneValide({ 0: 'CEG-0001' }),
      ligneValide({ 0: 'CEG-0002', 2: 'Autre', 4: 'Z', 8: '12' }), // sexe + téléphone invalides
      ligneValide({
        0: 'CEG-0003',
        2: 'Futur',
        5: new Date('2999-01-01T00:00:00Z'),
      }),
    ]);

    const e = await erreursDe(service.importer('etab-1', fichier(buffer)));

    expect(e.code).toBe('IMPORT_INVALIDE');
    expect(e.erreurs!.map((x) => x.ligne)).toEqual([3, 4]);
    expect(e.erreurs![0]!.messages.length).toBe(2);
    expect(eleve.createMany).not.toHaveBeenCalled();
  });

  it('détecte les doublons dans le fichier', async () => {
    const { service } = creerService();
    const buffer = await fabriquerXlsx([
      ligneValide(),
      ligneValide({ 2: 'Autre' }), // même matricule
      ligneValide({ 0: 'CEG-0009' }), // même identité que la ligne 2
    ]);
    const e = await erreursDe(service.importer('etab-1', fichier(buffer)));
    const parLigne = Object.fromEntries(
      e.erreurs!.map((x) => [x.ligne, x.messages.join(' ')]),
    );
    expect(parLigne[3]).toMatch(/Matricule déjà présent à la ligne 2/);
    expect(parLigne[4]).toMatch(/ligne 2/);
  });

  it('détecte les élèves déjà enregistrés (matricule et identité)', async () => {
    const { service, eleve } = creerService([
      {
        matricule: 'CEG-0001',
        matriculeEducMaster: null,
        nom: 'ADJAHO',
        prenoms: 'nadege', // casse/accents ignorés
        dateNaissance: new Date('2014-07-15T00:00:00Z'),
      },
    ]);
    const e = await erreursDe(
      service.importer('etab-1', fichier(await fabriquerXlsx([ligneValide()]))),
    );
    expect(e.erreurs![0]!.messages).toHaveLength(2);
    expect(eleve.findMany.mock.calls[0]![0].where.etablissementId).toBe(
      'etab-1',
    );
  });

  it('refuse l’absence de fichier', async () => {
    const { service } = creerService();
    const e = await erreursDe(service.importer('etab-1', undefined));
    expect(e.code).toBe('FICHIER_INVALIDE');
  });

  it('traduit un conflit d’unicité concurrent en 409 IMPORT_CONFLIT', async () => {
    const { service, eleve } = creerService();
    eleve.createMany.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.importer('etab-1', fichier(await fabriquerXlsx([ligneValide()]))),
    ).rejects.toMatchObject({ response: { code: 'IMPORT_CONFLIT' } });
  });
});

describe('colonnes Classe et Date d’inscription', () => {
  const entetes = [...ENTETES, 'Classe', "Date d'inscription"];

  it('sont lues, la date au format JJ/MM/AAAA comme en cellule date', async () => {
    const buffer = await fabriquerXlsx(
      [
        [...ligneValide(), 'CE1', '22/06/2023'],
        [
          ...ligneValide({ 0: 'CEG-2', 2: 'Autre' }),
          '3ème A',
          new Date('2022-09-12T00:00:00Z'),
        ],
      ],
      entetes,
    );
    const lignes = await lireFichierExcel(buffer);
    expect(lignes[0]!.valeurs).toMatchObject({
      classe: 'CE1',
      dateInscription: '2023-06-22',
    });
    expect(lignes[1]!.valeurs).toMatchObject({
      classe: '3ème A',
      dateInscription: '2022-09-12',
    });
  });

  it('sont facultatives : le fichier sans ces colonnes reste valide', async () => {
    const { service, eleve } = creerService();
    await service.importer(
      'etab-1',
      fichier(await fabriquerXlsx([ligneValide()])),
    );
    const { data } = eleve.createMany.mock.calls[0]![0];
    expect(data[0].classe).toBeNull();
    expect(data[0].dateInscription).toBeNull();
  });

  it('importe classe et date, et les indexe pour la recherche', async () => {
    const { service, eleve } = creerService();
    await service.importer(
      'etab-1',
      fichier(
        await fabriquerXlsx([[...ligneValide(), 'CE1', '22/06/2023']], entetes),
      ),
    );
    const { data } = eleve.createMany.mock.calls[0]![0];
    expect(data[0].classe).toBe('CE1');
    expect(data[0].dateInscription).toEqual(
      new Date('2023-06-22T00:00:00.000Z'),
    );
    expect(data[0].rechercheNormalisee).toBe('adjaho nadege ceg 0001 ce1');
  });

  it('signale une date d’inscription antérieure à la naissance, avec le numéro de ligne', async () => {
    const { service } = creerService();
    const e = await erreursDe(
      service.importer(
        'etab-1',
        fichier(
          await fabriquerXlsx(
            [[...ligneValide(), 'CE1', '01/01/2010']],
            entetes,
          ),
        ),
      ),
    );
    expect(e.erreurs).toEqual([
      {
        ligne: 2,
        messages: [
          "La date d'inscription doit être postérieure à la date de naissance.",
        ],
      },
    ]);
  });
});
