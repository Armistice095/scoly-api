import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { nettoyerTexte } from '../../eleves/utils/transformations.js';
import { SAISIE_LONGUEUR_ABSOLUE_MAX } from '../constantes.js';

/**
 * Corps de `POST /verification`. Les règles MÉTIER (champ vide, format,
 * « token OU reference ») ne sont pas ici mais dans lireRequete() : elles
 * doivent produire les codes `CHAMP_VIDE` / `FORMAT_INVALIDE` du contrat, que
 * la ValidationPipe globale n'émettrait pas (elle répond `VALIDATION_ERROR`).
 * Ce DTO ne garde que le contrôle de type et un plafond de taille.
 */
export class VerifierDocumentDto {
  /** Jeton lu dans le QR code (dernier segment de l'URL scannée). Exclusif avec `reference`. */
  @IsOptional()
  @Transform(nettoyerTexte)
  @IsString({ message: 'Le code du document est invalide.' })
  @MaxLength(SAISIE_LONGUEUR_ABSOLUE_MAX, {
    message: 'Le code du document est trop long.',
  })
  token?: string;

  /** Référence imprimée en haut du document, saisie librement. Exclusif avec `token`. */
  @IsOptional()
  @Transform(nettoyerTexte)
  @IsString({ message: 'La référence est invalide.' })
  @MaxLength(SAISIE_LONGUEUR_ABSOLUE_MAX, {
    message: 'La référence est trop longue.',
  })
  reference?: string;

  /** Nom (même partiel) de l'établissement : lève un résultat AMBIGU. Utilisé avec `reference` uniquement. */
  @IsOptional()
  @Transform(nettoyerTexte)
  @IsString({ message: "Le nom de l'établissement est invalide." })
  @MaxLength(SAISIE_LONGUEUR_ABSOLUE_MAX, {
    message: "Le nom de l'établissement est trop long.",
  })
  etablissement?: string;
}
