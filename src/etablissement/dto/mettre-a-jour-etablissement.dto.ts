import { OrdreEnseignement } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { TITRES_SIGNATAIRE } from '../titres-signataire.js';

export class MettreAJourEtablissementDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nom?: string;

  @IsOptional()
  @IsEnum(OrdreEnseignement)
  ordreEnseignement?: OrdreEnseignement;

  @IsOptional()
  @IsString()
  @MinLength(2)
  departement?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  commune?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  numeroAgrement?: string;

  @IsOptional()
  @Matches(/^[+0-9\s-]{6,20}$/, { message: 'Numéro de téléphone invalide.' })
  telephone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  directionDepartementale?: string;

  @IsOptional()
  @IsString()
  ministereTutelle?: string;

  @IsOptional()
  @IsString()
  devise?: string;

  @IsOptional()
  @IsString()
  nomSignataire?: string;

  @IsOptional()
  @IsIn(TITRES_SIGNATAIRE, {
    message: `Le titre du signataire doit être l'un des suivants : ${TITRES_SIGNATAIRE.join(', ')}.`,
  })
  fonctionSignataire?: string;

  @IsOptional()
  @IsString()
  @Matches(/\{N\}/, { message: 'Le format de référence doit contenir {N}.' })
  formatReference?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  prochainNumero?: number;

  @IsOptional()
  @IsString()
  lieuParDefaut?: string;
}
