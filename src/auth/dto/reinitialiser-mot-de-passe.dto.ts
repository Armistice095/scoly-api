import { IsString, Matches } from 'class-validator';

const REGLE_MOT_DE_PASSE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export class ReinitialiserMotDePasseDto {
  /** Jeton renvoyé par POST /auth/mot-de-passe-oublie/verifier, valable 10 minutes. */
  @IsString()
  resetToken!: string;

  @Matches(REGLE_MOT_DE_PASSE, {
    message:
      'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.',
  })
  nouveauMotDePasse!: string;

  @IsString()
  confirmationMotDePasse!: string;
}
