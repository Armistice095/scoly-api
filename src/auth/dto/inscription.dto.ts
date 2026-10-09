import { OrdreEnseignement } from '@prisma/client';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Le mot de passe doit respecter les règles affichées côté front :
 * 8 caractères minimum, au moins une majuscule, au moins un chiffre.
 */
const REGLE_MOT_DE_PASSE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export class InscriptionDto {
  // --- Étape 1 : établissement ---

  @IsString()
  @MinLength(2)
  nomEtablissement!: string;

  @IsEnum(OrdreEnseignement)
  ordreEnseignement!: OrdreEnseignement;

  @IsString()
  @MinLength(2)
  departement!: string;

  @IsString()
  @MinLength(2)
  commune!: string;

  // --- Étape 2 : compte administrateur ---

  @IsString()
  @MinLength(2)
  nomComplet!: string;

  @IsString()
  @MinLength(2)
  fonction!: string;

  @IsEmail()
  email!: string;

  @Matches(/^[+0-9\s-]{6,20}$/, { message: 'Numéro de téléphone invalide.' })
  telephone!: string;

  @Matches(REGLE_MOT_DE_PASSE, {
    message:
      'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.',
  })
  motDePasse!: string;

  @IsString()
  confirmationMotDePasse!: string;

  @IsBoolean()
  @Equals(true, {
    message: "Vous devez accepter les conditions d'utilisation.",
  })
  accepteConditions!: boolean;
}
