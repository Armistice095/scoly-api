import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StatutEleve } from '@prisma/client';

export const LIMITE_PAR_DEFAUT = 10;
export const LIMITE_MAX = 100;

export class ListerElevesQueryDto {
  /** Recherche sur nom, prénoms et matricules (plusieurs mots = tous doivent correspondre). */
  @IsOptional()
  @IsString({ message: 'La recherche est invalide.' })
  @MaxLength(100, {
    message: 'La recherche ne doit pas dépasser 100 caractères.',
  })
  search?: string;

  @IsOptional()
  @IsEnum(StatutEleve, { message: 'Le statut est invalide.' })
  statut?: StatutEleve;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La page doit être un nombre entier.' })
  @Min(1, { message: 'La page doit être supérieure ou égale à 1.' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La limite doit être un nombre entier.' })
  @Min(1, { message: 'La limite doit être supérieure ou égale à 1.' })
  @Max(LIMITE_MAX, {
    message: `La limite ne peut pas dépasser ${LIMITE_MAX}.`,
  })
  limit: number = LIMITE_PAR_DEFAUT;
}
