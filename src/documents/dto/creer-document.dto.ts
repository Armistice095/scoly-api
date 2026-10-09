import { IsDefined, IsObject, IsUUID } from 'class-validator';

/** Corps commun à l'aperçu (`POST /documents/apercu`) et à la génération (`POST /documents`). */
export class CreerDocumentDto {
  @IsUUID(undefined, { message: "L'élève est obligatoire." })
  eleveId!: string;

  @IsUUID(undefined, { message: 'Le type de document est obligatoire.' })
  typeDocumentId!: string;

  /**
   * Champs propres au type (voir `champs` dans GET /types-documents). Leur
   * contenu est validé par le service selon la définition du type, pas par
   * class-validator : chaque type a ses propres champs.
   */
  @IsDefined({ message: 'Les champs du document sont obligatoires.' })
  @IsObject({ message: 'Les champs du document sont invalides.' })
  champsSaisis!: Record<string, unknown>;
}
