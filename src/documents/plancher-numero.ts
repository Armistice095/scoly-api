import type { Prisma } from '@prisma/client';
import { formatRepartACadaAnnee } from './numerotation.js';

/** Ce dont on a besoin de Prisma (client ou transaction) : lisible et simple à simuler dans les tests. */
export type LecteurDocuments = Pick<Prisma.TransactionClient, 'document'>;

/**
 * Plus petit « prochain numéro » qu'on peut programmer sans réutiliser une
 * référence déjà attribuée : (plus grand numéro d'ordre déjà émis) + 1.
 *
 * - Tous les documents comptent, annulés compris : une référence annulée reste
 *   définitivement prise.
 * - Si le format contient {ANNEE}, la numérotation repart de 1 à chaque année
 *   scolaire : on ne regarde que les documents de l'année concernée. Sinon la
 *   numérotation est continue : tous les documents de l'établissement comptent.
 * - Les documents sans `numeroOrdre` (créés avant ce champ) sont ignorés ; la
 *   contrainte d'unicité (établissement, référence) reste le dernier filet.
 *
 * `anneeLibelle` = libellé de l'année scolaire concernée (« 2025-2026 »), tel
 * qu'imprimé dans les références.
 */
export async function plancherProchainNumero(
  db: LecteurDocuments,
  etablissementId: string,
  formatReference: string | null,
  anneeLibelle: string | null,
): Promise<number> {
  const parAnnee = formatRepartACadaAnnee(formatReference);
  // Format par année mais aucune année active : aucun document n'a pu y être
  // émis (formaterNumeroReference refuse de générer sans année).
  if (parAnnee && !anneeLibelle) return 1;

  const { _max } = await db.document.aggregate({
    where: {
      etablissementId,
      numeroOrdre: { not: null },
      ...(parAnnee && anneeLibelle
        ? { donneesFigees: { path: ['anneeScolaire'], equals: anneeLibelle } }
        : {}),
    },
    _max: { numeroOrdre: true },
  });

  return (_max?.numeroOrdre ?? 0) + 1;
}
