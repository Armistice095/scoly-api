/**
 * Renseigne l'en-tête officiel (ministère, direction départementale, devise)
 * des établissements qui ne l'ont pas encore. Ne touche QUE les champs vides :
 * une valeur déjà saisie (même ancienne) n'est jamais écrasée.
 *
 * À lancer une fois après le déploiement :
 *     pnpm run etablissement:backfill-entete
 * Idempotent : relançable sans risque.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  CHAMPS_ENTETE,
  enteteParDefaut,
} from '../src/etablissement/entete-officielle.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const etablissements = await prisma.etablissement.findMany({
    select: {
      id: true,
      ordreEnseignement: true,
      departement: true,
      ministereTutelle: true,
      directionDepartementale: true,
      devise: true,
    },
  });

  let modifies = 0;
  for (const e of etablissements) {
    const defauts = enteteParDefaut(e.ordreEnseignement, e.departement);
    const data: Record<string, string> = {};
    for (const champ of CHAMPS_ENTETE) {
      const valeur = defauts[champ];
      if (!e[champ]?.trim() && valeur) data[champ] = valeur;
    }
    if (Object.keys(data).length === 0) continue;
    await prisma.etablissement.update({ where: { id: e.id }, data });
    modifies++;
  }
  console.log(
    `Terminé : ${modifies}/${etablissements.length} établissement(s) mis à jour.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
