import { CERTIFICAT_SCOLARITE } from './certificat-scolarite.js';
import type { TypeDocumentDefinition } from './definitions.js';

/**
 * Types de documents réellement générables (champs + modèle PDF). Un type
 * présent en base mais absent d'ici est affiché « Bientôt disponible ».
 * Ajouter un type = ajouter sa définition ici (+ une ligne en base).
 */
const DEFINITIONS: readonly TypeDocumentDefinition[] = [CERTIFICAT_SCOLARITE];

export const REGISTRE_TYPES = new Map<string, TypeDocumentDefinition>(
  DEFINITIONS.map((definition) => [definition.code, definition]),
);
