import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Sexe } from '@prisma/client';
import {
  nettoyerTexte,
  nettoyerTexteOptionnel,
} from '../utils/transformations.js';
import { normaliserTelephone, REGEX_TELEPHONE } from '../utils/telephone.js';
import { EstDateNaissanceValide } from '../validators/est-date-naissance.validator.js';
import { EstDateInscriptionValide } from '../validators/est-date-inscription.validator.js';

/**
 * Règles de validation de chaque champ élève, définies UNE seule fois et
 * réutilisées par la création (champs obligatoires), la modification (mêmes
 * règles, champs facultatifs) et l'import Excel (qui passe chaque ligne par
 * CreerEleveDto). Changer une règle ici la change partout.
 */

export const ChampTexteObligatoire = (
  libelle: string,
  max: number,
  pluriel = false,
) => {
  const obligatoire = `${libelle} ${pluriel ? 'sont obligatoires' : 'est obligatoire'}.`;
  return applyDecorators(
    Transform(nettoyerTexte),
    IsString({ message: obligatoire }),
    IsNotEmpty({ message: obligatoire }),
    MaxLength(max, {
      message: `${libelle} ne doit pas dépasser ${max} caractères.`,
    }),
  );
};

/** Facultatif : absent, `null` ou chaîne vide = pas de valeur. */
export const ChampTexteOptionnel = (libelle: string, max: number) =>
  applyDecorators(
    Transform(nettoyerTexteOptionnel),
    IsOptional(),
    IsString({ message: `${libelle} est invalide.` }),
    MaxLength(max, {
      message: `${libelle} ne doit pas dépasser ${max} caractères.`,
    }),
  );

export const ChampSexe = () =>
  applyDecorators(
    IsEnum(Sexe, { message: 'Le sexe est obligatoire (Masculin ou Féminin).' }),
  );

export const ChampDateNaissance = () =>
  applyDecorators(Transform(nettoyerTexte), EstDateNaissanceValide());

export const ChampTelephone = () =>
  applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' ? normaliserTelephone(value) : value,
    ),
    IsString({ message: 'Le téléphone est obligatoire.' }),
    IsNotEmpty({ message: 'Le téléphone est obligatoire.' }),
    Matches(REGEX_TELEPHONE, {
      message:
        'Numéro de téléphone invalide (10 chiffres, ou format international commençant par +).',
    }),
  );

/** Facultative : absente, `null` ou vide = non renseignée. Format AAAA-MM-JJ. */
export const ChampDateInscription = () =>
  applyDecorators(
    Transform(nettoyerTexteOptionnel),
    IsOptional(),
    EstDateInscriptionValide(),
  );
