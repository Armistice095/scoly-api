import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { creerExceptionValidation } from '../../common/validation/erreurs-validation.js';
import { CreerEleveDto } from './creer-eleve.dto.js';
import { ListerElevesQueryDto } from './lister-eleves-query.dto.js';

vi.mock('@prisma/client', () => ({
  Sexe: { MASCULIN: 'MASCULIN', FEMININ: 'FEMININ' },
  StatutEleve: { ACTIF: 'ACTIF' },
}));

// Même configuration que src/main.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: creerExceptionValidation,
});

async function reponse400(
  valeur: unknown,
  metatype: new () => object,
  type: 'body' | 'query' = 'body',
) {
  try {
    await pipe.transform(valeur, { type, metatype });
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return (e as BadRequestException).getResponse();
  }
  throw new Error('400 attendu');
}

describe('400 de validation (pipe réel)', () => {
  it('donne le champ de chaque erreur, un message par champ', async () => {
    const r = await reponse400(
      {
        nom: '',
        sexe: 'X',
        dateNaissance: '2999-01-01',
        telephone: '12',
        statut: 'PARTI',
      },
      CreerEleveDto,
    );

    expect(r).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    const parChamp = Object.fromEntries(
      (r as { erreurs: { champ: string; message: string }[] }).erreurs.map(
        (e) => [e.champ, e.message],
      ),
    );
    expect(parChamp).toEqual({
      nom: 'Le nom est obligatoire.',
      prenoms: 'Les prénoms sont obligatoires.',
      sexe: 'Le sexe est obligatoire (Masculin ou Féminin).',
      dateNaissance: 'La date de naissance ne peut pas être dans le futur.',
      lieuNaissance: 'Le lieu de naissance est obligatoire.',
      parentTuteur: 'Le parent ou tuteur est obligatoire.',
      telephone:
        'Numéro de téléphone invalide (10 chiffres, ou format international commençant par +).',
      statut: "Le champ « statut » n'est pas autorisé.",
    });
    // Compatibilité : `message` reste un tableau de phrases.
    expect((r as { message: string[] }).message).toHaveLength(8);
  });

  it('valide aussi la query de liste, en français', async () => {
    const r = await reponse400(
      { page: '0', limit: '500' },
      ListerElevesQueryDto,
      'query',
    );
    expect((r as { erreurs: unknown[] }).erreurs).toEqual([
      { champ: 'page', message: 'La page doit être supérieure ou égale à 1.' },
      { champ: 'limit', message: 'La limite ne peut pas dépasser 100.' },
    ]);
  });
});
