import { ValidationPipe } from '@nestjs/common';
import { creerExceptionValidation } from '../../common/validation/erreurs-validation.js';
import { MettreAJourEtablissementDto } from './mettre-a-jour-etablissement.dto.js';

vi.mock('@prisma/client', () => ({
  OrdreEnseignement: { PRIMAIRE: 'PRIMAIRE', SECONDAIRE: 'SECONDAIRE' },
}));

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: creerExceptionValidation,
});
const valider = (body: object) =>
  pipe.transform(body, { type: 'body', metatype: MettreAJourEtablissementDto });

describe('titre du signataire', () => {
  it.each(['Directeur', 'Directrice', 'Proviseur', 'Proviseure'])(
    'accepte « %s »',
    async (titre) => {
      await expect(
        valider({ fonctionSignataire: titre }),
      ).resolves.toBeDefined();
    },
  );

  it.each(['Le Directeur et PO,\nLa Secrétaire', 'directeur', 'Censeur', ''])(
    'refuse « %s »',
    async (titre) => {
      await expect(
        valider({ fonctionSignataire: titre }),
      ).rejects.toMatchObject({
        response: {
          code: 'VALIDATION_ERROR',
          erreurs: [{ champ: 'fonctionSignataire' }],
        },
      });
    },
  );
});
