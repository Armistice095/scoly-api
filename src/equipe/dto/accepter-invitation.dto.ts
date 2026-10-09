import { IsString, Matches, MinLength } from 'class-validator';

const REGLE_MOT_DE_PASSE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export class AccepterInvitationDto {
  @IsString()
  id!: string;

  @IsString()
  token!: string;

  @IsString()
  @MinLength(2)
  nomComplet!: string;

  @Matches(/^[+0-9\s-]{6,20}$/, { message: 'Numéro de téléphone invalide.' })
  telephone!: string;

  @Matches(REGLE_MOT_DE_PASSE, {
    message:
      'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.',
  })
  motDePasse!: string;

  @IsString()
  confirmationMotDePasse!: string;
}
