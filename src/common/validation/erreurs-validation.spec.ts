import { IsNotEmpty, IsString, MaxLength, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  aplatirErreurs,
  creerExceptionValidation,
} from './erreurs-validation.js';

class Exemple {
  @IsString({ message: 'Le nom est obligatoire.' })
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(5, { message: 'Le nom est trop long.' })
  nom!: string;
}

const valider = (donnees: object) =>
  validateSync(plainToInstance(Exemple, donnees), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('aplatirErreurs', () => {
  it('donne un seul message par champ, « obligatoire » avant « longueur max »', () => {
    expect(aplatirErreurs(valider({}))).toEqual([
      { champ: 'nom', message: 'Le nom est obligatoire.' },
    ]);
  });

  it('garde le message de longueur quand c’est la seule règle violée', () => {
    expect(aplatirErreurs(valider({ nom: 'abcdefgh' }))).toEqual([
      { champ: 'nom', message: 'Le nom est trop long.' },
    ]);
  });

  it('traduit le rejet d’un champ non déclaré', () => {
    expect(aplatirErreurs(valider({ nom: 'abc', statut: 'X' }))).toEqual([
      { champ: 'statut', message: "Le champ « statut » n'est pas autorisé." },
    ]);
  });
});

describe('creerExceptionValidation', () => {
  it('garde `message` en tableau (compatibilité) et ajoute `erreurs` + `code`', () => {
    const reponse = creerExceptionValidation(valider({})).getResponse();
    expect(reponse).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: ['Le nom est obligatoire.'],
      erreurs: [{ champ: 'nom', message: 'Le nom est obligatoire.' }],
    });
  });
});
