import { ValidationPipe } from '@nestjs/common';
import { creerExceptionValidation } from '../../common/validation/erreurs-validation.js';
import { EnteteParDefautQueryDto } from './entete-par-defaut-query.dto.js';

vi.mock('@prisma/client', () => ({
  OrdreEnseignement: {
    MATERNELLE: 'MATERNELLE',
    PRIMAIRE: 'PRIMAIRE',
    SECONDAIRE: 'SECONDAIRE',
  },
}));

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: creerExceptionValidation,
});
const valider = (query: object) =>
  pipe.transform(query, { type: 'query', metatype: EnteteParDefautQueryDto });

describe('GET /etablissement/entete-par-defaut — validation', () => {
  it('accepte un ordre et un département', async () => {
    await expect(
      valider({ ordreEnseignement: 'PRIMAIRE', departement: 'Couffo' }),
    ).resolves.toBeDefined();
  });

  it.each([
    { departement: 'Couffo' },
    { ordreEnseignement: 'PRIMAIRE' },
    { ordreEnseignement: 'COLLEGE', departement: 'Couffo' },
    { ordreEnseignement: 'PRIMAIRE', departement: '' },
  ])('refuse %j', async (query) => {
    await expect(valider(query)).rejects.toBeDefined();
  });
});
