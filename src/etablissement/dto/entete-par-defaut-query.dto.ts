import { OrdreEnseignement } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class EnteteParDefautQueryDto {
  @IsEnum(OrdreEnseignement, {
    message: "L'ordre d'enseignement est invalide.",
  })
  ordreEnseignement!: OrdreEnseignement;

  @IsString({ message: 'Le département est obligatoire.' })
  @MinLength(2, { message: 'Le département est obligatoire.' })
  @MaxLength(50, { message: 'Le département est invalide.' })
  departement!: string;
}
