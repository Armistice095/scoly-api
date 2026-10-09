import { IsString, Matches, MinLength } from 'class-validator';

const REGLE_MOT_DE_PASSE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export class ChangerMotDePasseDto {
  @IsString()
  @MinLength(1)
  motDePasseActuel!: string;

  @Matches(REGLE_MOT_DE_PASSE, {
    message:
      'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.',
  })
  nouveauMotDePasse!: string;

  @IsString()
  confirmationMotDePasse!: string;
}
