import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AnnulerDocumentDto } from './annuler-document.dto.js';
import { ListerArchivesQueryDto } from './lister-archives-query.dto.js';

// Le client Prisma n'est pas généré dans tous les environnements de test :
// on ne dépend que des valeurs d'enum.
vi.mock('@prisma/client', () => ({
  StatutEleve: { ACTIF: 'ACTIF' },
  StatutDocument: { ACTIF: 'ACTIF', ANNULE: 'ANNULE' },
}));

const options = { whitelist: true, forbidNonWhitelisted: true };
const instance = <T extends object>(classe: new () => T, donnees: object) =>
  plainToInstance(classe, donnees) as T;
const messages = (classe: new () => object, donnees: object) =>
  validateSync(instance(classe, donnees), options).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );

const UUID = '6f1c1b1e-6a3a-4e0a-9f58-0c1d2e3f4a5b';

describe('AnnulerDocumentDto', () => {
  it('accepte un motif valide et retire les espaces autour', () => {
    const dto = instance(AnnulerDocumentDto, {
      motif: '  Erreur sur le nom de l’élève  ',
    });
    expect(validateSync(dto, options)).toHaveLength(0);
    expect(dto.motif).toBe('Erreur sur le nom de l’élève');
  });

  it.each([
    ['absent', {}],
    ['vide', { motif: '' }],
    ['que des espaces', { motif: '     ' }],
  ])('refuse un motif %s (obligatoire)', (_nom, corps) => {
    expect(messages(AnnulerDocumentDto, corps)).toContain(
      "Le motif de l'annulation est obligatoire.",
    );
  });

  it('refuse un motif trop court ou trop long', () => {
    expect(messages(AnnulerDocumentDto, { motif: 'ab' })).toEqual([
      'Le motif doit contenir au moins 5 caractères.',
    ]);
    expect(messages(AnnulerDocumentDto, { motif: 'x'.repeat(501) })).toEqual([
      'Le motif ne doit pas dépasser 500 caractères.',
    ]);
  });

  it('refuse un motif qui n’est pas du texte', () => {
    expect(messages(AnnulerDocumentDto, { motif: 12345 })).not.toHaveLength(0);
  });

  it('refuse les champs en trop (on ne peut pas glisser un auteur ou une date)', () => {
    expect(
      messages(AnnulerDocumentDto, {
        motif: 'Erreur de saisie',
        annuleParId: 'autre',
        createdAt: '2020-01-01',
      }),
    ).not.toHaveLength(0);
  });
});

describe('ListerArchivesQueryDto', () => {
  it('valeurs par défaut : page 1, 10 par page, plus récents d’abord', () => {
    const dto = instance(ListerArchivesQueryDto, {});
    expect(validateSync(dto, options)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 10, tri: 'recent' });
  });

  it('convertit page et limit venant de l’URL (texte)', () => {
    const dto = instance(ListerArchivesQueryDto, { page: '3', limit: '25' });
    expect(validateSync(dto, options)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 3, limit: 25 });
  });

  it('un filtre vide (« Tous les statuts ») veut dire « pas de filtre »', () => {
    const dto = instance(ListerArchivesQueryDto, {
      statut: '',
      typeDocumentId: '',
      eleveId: '',
      search: '',
      tri: '',
    });
    expect(validateSync(dto, options)).toHaveLength(0);
    expect(dto.statut).toBeUndefined();
    expect(dto.typeDocumentId).toBeUndefined();
  });

  it('accepte des filtres valides', () => {
    const dto = instance(ListerArchivesQueryDto, {
      search: 'adjovi',
      statut: 'ANNULE',
      typeDocumentId: UUID,
      eleveId: UUID,
      tri: 'ancien',
    });
    expect(validateSync(dto, options)).toHaveLength(0);
  });

  it.each([
    ['statut', { statut: 'SUPPRIME' }, 'Le statut est invalide.'],
    [
      'type',
      { typeDocumentId: 'pas-un-uuid' },
      'Le type de document est invalide.',
    ],
    ['élève', { eleveId: 'pas-un-uuid' }, "L'élève est invalide."],
    ['tri', { tri: 'alphabetique' }, 'Le tri est invalide.'],
    ['page', { page: '0' }, 'La page doit être supérieure ou égale à 1.'],
    ['limite', { limit: '1000' }, 'La limite ne peut pas dépasser 100.'],
    ['page décimale', { page: '1.5' }, 'La page doit être un nombre entier.'],
  ])('refuse %s invalide', (_nom, corps, message) => {
    expect(messages(ListerArchivesQueryDto, corps)).toContain(message);
  });

  it('refuse une recherche de plus de 100 caractères', () => {
    expect(
      messages(ListerArchivesQueryDto, { search: 'a'.repeat(101) }),
    ).toContain('La recherche ne doit pas dépasser 100 caractères.');
  });
});
