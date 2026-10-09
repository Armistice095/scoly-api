/**
 * Renseigne `documents.reference_normalisee` pour les documents émis AVANT la
 * fonctionnalité « Vérification publique » (sans cela, la saisie manuelle ne
 * les retrouve pas ; leur QR code, lui, fonctionne déjà).
 *
 * À lancer UNE fois, juste après `prisma migrate deploy` :
 *     pnpm run verification:backfill
 * Idempotent : ne touche que les lignes encore à NULL, relançable sans risque.
 *
 * Le trigger d'immuabilité interdit tout UPDATE sur « documents » ; on utilise
 * son échappatoire documentée (variable de session `scoly.autoriser_purge`,
 * limitée à la transaction par SET LOCAL). Seule cette colonne dérivée est
 * écrite : aucune donnée émise (référence, snapshot, statut) n'est modifiée.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { normaliserReference } from '../src/documents/reference-normalisee.js';

const LOT = 500;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  let total = 0;
  for (;;) {
    const lot = await prisma.document.findMany({
      where: { referenceNormalisee: null },
      select: { id: true, numeroUnique: true },
      take: LOT,
      orderBy: { id: 'asc' },
    });
    if (lot.length === 0) break;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('scoly.autoriser_purge', 'on', true)`;
      for (const { id, numeroUnique } of lot) {
        await tx.document.update({
          where: { id },
          data: { referenceNormalisee: normaliserReference(numeroUnique) },
        });
      }
    });
    total += lot.length;
    console.log(`… ${total} document(s) renseigné(s)`);
  }
  console.log(`Terminé : ${total} document(s) mis à jour.`);
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
