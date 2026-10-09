import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreerAnneeScolaireDto {
  @IsString()
  @MinLength(4)
  libelle!: string; // ex. "2025-2026"

  @IsDateString()
  dateRentree!: string;

  @IsDateString()
  dateFin!: string;
}
