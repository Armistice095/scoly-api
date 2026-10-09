import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class ModifierAnneeScolaireDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  libelle?: string;

  @IsOptional()
  @IsDateString()
  dateRentree?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;
}
