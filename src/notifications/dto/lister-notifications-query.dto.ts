import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CategorieNotification, TypeNotification } from '@prisma/client';

export const LIMITE_PAR_DEFAUT = 10;
export const LIMITE_MAX = 50;

export const STATUTS_NOTIFICATION = ['toutes', 'non-lues'] as const;
export type StatutNotification = (typeof STATUTS_NOTIFICATION)[number];

/** Un filtre laissé vide par le front (« Tous les types » = ``) veut dire « pas de filtre », pas « valeur invalide ». */
const videEnAbsent = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class ListerNotificationsQueryDto {
  /** Onglets « Toutes » (défaut) / « Non lues ». */
  @IsOptional()
  @Transform(videEnAbsent)
  @IsIn(STATUTS_NOTIFICATION, { message: 'Le statut est invalide.' })
  statut: StatutNotification = 'toutes';

  /** Menu « Tous les types » : un évènement précis. */
  @IsOptional()
  @Transform(videEnAbsent)
  @IsEnum(TypeNotification, { message: 'Le type est invalide.' })
  type?: TypeNotification;

  /** Regroupement (Documents / Équipe). Peut se combiner avec `type`. */
  @IsOptional()
  @Transform(videEnAbsent)
  @IsEnum(CategorieNotification, { message: 'La catégorie est invalide.' })
  categorie?: CategorieNotification;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La page doit être un nombre entier.' })
  @Min(1, { message: 'La page doit être supérieure ou égale à 1.' })
  page: number = 1;

  /** Cloche : `limite=5`. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La limite doit être un nombre entier.' })
  @Min(1, { message: 'La limite doit être supérieure ou égale à 1.' })
  @Max(LIMITE_MAX, {
    message: `La limite ne peut pas dépasser ${LIMITE_MAX}.`,
  })
  limite: number = LIMITE_PAR_DEFAUT;
}
