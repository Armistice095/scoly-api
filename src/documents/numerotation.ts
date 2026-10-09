import { ConflictException } from '@nestjs/common';

/** Utilisé quand l'établissement n'a pas défini de format dans ses paramètres. */
export const FORMAT_REFERENCE_PAR_DEFAUT = 'N°{N}/{ANNEE}';

/** Un format qui contient {ANNEE} repart de 1 à chaque nouvelle année scolaire. */
export function formatRepartACadaAnnee(format: string | null): boolean {
  const effectif = format?.trim() || FORMAT_REFERENCE_PAR_DEFAUT;
  return effectif.includes('{ANNEE}');
}

/**
 * Construit le numéro de référence imprimé sur un document à partir du format
 * des paramètres. `{N}` = numéro d'ordre, `{ANNEE}` = libellé de l'année
 * scolaire active (« 2025-2026 »). Le numéro est imprimé tel quel : c'est le
 * format qui porte le « N° » éventuel.
 *
 * `numero` vaut `null` pour un aperçu : on affiche « … » à la place du numéro
 * (il n'est attribué qu'à la génération réelle).
 */
export function formaterNumeroReference(
  format: string | null,
  numero: number | null,
  anneeScolaire: string | null,
): string {
  const modele = format?.trim() || FORMAT_REFERENCE_PAR_DEFAUT;

  if (modele.includes('{ANNEE}') && !anneeScolaire) {
    throw new ConflictException({
      message:
        "Aucune année scolaire active : le format de référence utilise l'année. Activez une année scolaire dans les paramètres.",
      code: 'ANNEE_SCOLAIRE_MANQUANTE',
    });
  }

  return modele
    .replaceAll('{N}', numero === null ? '…' : String(numero))
    .replaceAll('{ANNEE}', anneeScolaire ?? '');
}
