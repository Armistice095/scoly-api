import { IsBoolean, IsOptional, ValidateIf } from 'class-validator';
import type { Sexe } from '@prisma/client';
import {
  ChampDateInscription,
  ChampDateNaissance,
  ChampSexe,
  ChampTelephone,
  ChampTexteObligatoire,
  ChampTexteOptionnel,
} from './champs-eleve.decorators.js';

/**
 * Mise à jour partielle : seuls les champs envoyés sont modifiés.
 *
 * - Champs obligatoires : on utilise ValidateIf (et non IsOptional) pour
 *   qu'un `null` explicite soit REFUSÉ au lieu d'être ignoré — sinon il
 *   atteindrait Prisma et casserait une colonne NOT NULL.
 * - Champs facultatifs (matricules, adresse) : `null` ou `""` les efface.
 */
const estDefini = (_objet: unknown, valeur: unknown) => valeur !== undefined;

export class ModifierEleveDto {
  @ChampTexteOptionnel('Le matricule', 50)
  matricule?: string | null;

  @ChampTexteOptionnel('Le matricule EducMaster', 50)
  matriculeEducMaster?: string | null;

  @ValidateIf(estDefini)
  @ChampTexteObligatoire('Le nom', 100)
  nom?: string;

  @ValidateIf(estDefini)
  @ChampTexteObligatoire('Les prénoms', 150, true)
  prenoms?: string;

  @ValidateIf(estDefini)
  @ChampSexe()
  sexe?: Sexe;

  @ValidateIf(estDefini)
  @ChampDateNaissance()
  dateNaissance?: string;

  @ValidateIf(estDefini)
  @ChampTexteObligatoire('Le lieu de naissance', 100)
  lieuNaissance?: string;

  @ValidateIf(estDefini)
  @ChampTexteObligatoire('Le parent ou tuteur', 150)
  parentTuteur?: string;

  @ValidateIf(estDefini)
  @ChampTelephone()
  telephone?: string;

  @ChampTexteOptionnel("L'adresse", 255)
  adresse?: string | null;

  @ChampTexteOptionnel('La classe', 30)
  classe?: string | null;

  @ChampDateInscription()
  dateInscription?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'confirmerDoublon doit être un booléen.' })
  confirmerDoublon?: boolean;
}
