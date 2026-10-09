import { IsBoolean, IsOptional } from 'class-validator';
import type { Sexe } from '@prisma/client';
import {
  ChampDateInscription,
  ChampDateNaissance,
  ChampSexe,
  ChampTelephone,
  ChampTexteObligatoire,
  ChampTexteOptionnel,
} from './champs-eleve.decorators.js';

export class CreerEleveDto {
  @ChampTexteOptionnel('Le matricule', 50)
  matricule?: string | null;

  @ChampTexteOptionnel('Le matricule EducMaster', 50)
  matriculeEducMaster?: string | null;

  @ChampTexteObligatoire('Le nom', 100)
  nom!: string;

  @ChampTexteObligatoire('Les prénoms', 150, true)
  prenoms!: string;

  @ChampSexe()
  sexe!: Sexe;

  /** Format AAAA-MM-JJ. */
  @ChampDateNaissance()
  dateNaissance!: string;

  @ChampTexteObligatoire('Le lieu de naissance', 100)
  lieuNaissance!: string;

  @ChampTexteObligatoire('Le parent ou tuteur', 150)
  parentTuteur!: string;

  @ChampTelephone()
  telephone!: string;

  @ChampTexteOptionnel("L'adresse", 255)
  adresse?: string | null;

  /** Facultative. Texte libre (« CE1 », « 3ème A »…). */
  @ChampTexteOptionnel('La classe', 30)
  classe?: string | null;

  /** Facultative, format AAAA-MM-JJ. */
  @ChampDateInscription()
  dateInscription?: string | null;

  /**
   * À renvoyer à `true` après un 409 `ELEVE_DOUBLON_POSSIBLE` pour confirmer
   * que l'homonyme est bien un autre élève. Jamais stocké.
   */
  @IsOptional()
  @IsBoolean({ message: 'confirmerDoublon doit être un booléen.' })
  confirmerDoublon?: boolean;
}
