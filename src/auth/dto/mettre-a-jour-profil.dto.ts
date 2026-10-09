import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class MettreAJourProfilDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nomComplet?: string;

  @IsOptional()
  @Matches(/^[+0-9\s-]{6,20}$/, { message: 'Numéro de téléphone invalide.' })
  telephone?: string;
}
