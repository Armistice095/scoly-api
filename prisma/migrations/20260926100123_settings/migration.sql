/*
  Warnings:

  - The values [ADMIN] on the enum `RoleUtilisateur` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[annee_scolaire_active_id]` on the table `etablissements` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RoleUtilisateur_new" AS ENUM ('DIRECTEUR', 'MEMBRE');
ALTER TABLE "public"."utilisateurs" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "utilisateurs" ALTER COLUMN "role" TYPE "RoleUtilisateur_new" USING ("role"::text::"RoleUtilisateur_new");
ALTER TYPE "RoleUtilisateur" RENAME TO "RoleUtilisateur_old";
ALTER TYPE "RoleUtilisateur_new" RENAME TO "RoleUtilisateur";
DROP TYPE "public"."RoleUtilisateur_old";
ALTER TABLE "utilisateurs" ALTER COLUMN "role" SET DEFAULT 'MEMBRE';
COMMIT;

-- AlterEnum
ALTER TYPE "TypeCodeVerification" ADD VALUE 'INVITATION_EQUIPE';

-- AlterTable
ALTER TABLE "etablissements" ADD COLUMN     "annee_scolaire_active_id" TEXT,
ADD COLUMN     "cachet_chemin" TEXT,
ADD COLUMN     "devise" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "format_reference" TEXT,
ADD COLUMN     "lieu_par_defaut" TEXT,
ADD COLUMN     "logo_chemin" TEXT,
ADD COLUMN     "ministere_tutelle" TEXT,
ADD COLUMN     "numero_agrement" TEXT,
ADD COLUMN     "prochain_numero" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "signature_chemin" TEXT,
ADD COLUMN     "telephone" TEXT;

-- AlterTable
ALTER TABLE "utilisateurs" ALTER COLUMN "mot_de_passe_hash" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'MEMBRE';

-- CreateTable
CREATE TABLE "annees_scolaires" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "date_rentree" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annees_scolaires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "annees_scolaires_etablissement_id_idx" ON "annees_scolaires"("etablissement_id");

-- CreateIndex
CREATE UNIQUE INDEX "etablissements_annee_scolaire_active_id_key" ON "etablissements"("annee_scolaire_active_id");

-- AddForeignKey
ALTER TABLE "etablissements" ADD CONSTRAINT "etablissements_annee_scolaire_active_id_fkey" FOREIGN KEY ("annee_scolaire_active_id") REFERENCES "annees_scolaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annees_scolaires" ADD CONSTRAINT "annees_scolaires_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
