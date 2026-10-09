import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class ConnexionDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  motDePasse!: string;

  @IsOptional()
  @IsBoolean()
  resterConnecte?: boolean;
}
