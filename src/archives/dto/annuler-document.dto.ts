import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { nettoyerTexte } from '../../eleves/utils/transformations.js';

export const MOTIF_LONGUEUR_MIN = 5;
export const MOTIF_LONGUEUR_MAX = 500;

export class AnnulerDocumentDto {
  /** Raison de l'annulation, conservée à vie avec l'auteur et la date. */
  @Transform(nettoyerTexte)
  @IsString({ message: "Le motif de l'annulation est obligatoire." })
  @IsNotEmpty({ message: "Le motif de l'annulation est obligatoire." })
  @MinLength(MOTIF_LONGUEUR_MIN, {
    message: `Le motif doit contenir au moins ${MOTIF_LONGUEUR_MIN} caractères.`,
  })
  @MaxLength(MOTIF_LONGUEUR_MAX, {
    message: `Le motif ne doit pas dépasser ${MOTIF_LONGUEUR_MAX} caractères.`,
  })
  motif: string;
}
