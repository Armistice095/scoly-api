import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StatutDocument } from '@prisma/client';
import {
  LIMITE_MAX,
  LIMITE_PAR_DEFAUT,
} from '../../eleves/dto/lister-eleves-query.dto.js';

export const TRIS_ARCHIVES = ['recent', 'ancien'] as const;
export type TriArchives = (typeof TRIS_ARCHIVES)[number];

/** Un filtre laissé vide par le front (« Tous les statuts » = ``) veut dire « pas de filtre », pas « valeur invalide ». */
const videEnAbsent = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class ListerArchivesQueryDto {
  /** Recherche sur la référence et l'élève (nom, prénoms, matricules) ; plusieurs mots = tous doivent correspondre. */
  @IsOptional()
  @Transform(videEnAbsent)
  @IsString({ message: 'La recherche est invalide.' })
  @MaxLength(100, {
    message: 'La recherche ne doit pas dépasser 100 caractères.',
  })
  search?: string;

  @IsOptional()
  @Transform(videEnAbsent)
  @IsUUID('all', { message: 'Le type de document est invalide.' })
  typeDocumentId?: string;

  /** Archives d'un seul élève (utile pour l'onglet « documents » d'une fiche élève). */
  @IsOptional()
  @Transform(videEnAbsent)
  @IsUUID('all', { message: "L'élève est invalide." })
  eleveId?: string;

  @IsOptional()
  @Transform(videEnAbsent)
  @IsEnum(StatutDocument, { message: 'Le statut est invalide.' })
  statut?: StatutDocument;

  /** `recent` (défaut) = plus récents d'abord ; `ancien` = plus anciens d'abord. */
  @IsOptional()
  @Transform(videEnAbsent)
  @IsIn(TRIS_ARCHIVES, { message: 'Le tri est invalide.' })
  tri: TriArchives = 'recent';

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
