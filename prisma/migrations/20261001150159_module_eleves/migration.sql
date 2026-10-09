/*
  Warnings:

  - The values [TRANSFERE,PARTI] on the enum `StatutEleve` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `classe` on the `eleves` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[etablissement_id,matricule]` on the table `eleves` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[etablissement_id,matricule_educ_master]` on the table `eleves` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `parent_tuteur` to the `eleves` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sexe` to the `eleves` table without a default value. This is not possible if the table is not empty.
  - Added the required column `telephone` to the `eleves` table without a default value. This is not possible if the table is not empty.
  - Made the column `lieu_naissance` on table `eleves` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('MASCULIN', 'FEMININ');

-- AlterEnum
BEGIN;
CREATE TYPE "StatutEleve_new" AS ENUM ('ACTIF');
ALTER TABLE "public"."eleves" ALTER COLUMN "statut" DROP DEFAULT;
ALTER TABLE "eleves" ALTER COLUMN "statut" TYPE "StatutEleve_new" USING ("statut"::text::"StatutEleve_new");
ALTER TYPE "StatutEleve" RENAME TO "StatutEleve_old";
ALTER TYPE "StatutEleve_new" RENAME TO "StatutEleve";
DROP TYPE "public"."StatutEleve_old";
ALTER TABLE "eleves" ALTER COLUMN "statut" SET DEFAULT 'ACTIF';
COMMIT;

-- DropIndex
DROP INDEX "eleves_etablissement_id_idx";

-- AlterTable
ALTER TABLE "eleves" DROP COLUMN "classe",
ADD COLUMN     "adresse" TEXT,
ADD COLUMN     "matricule_educ_master" TEXT,
ADD COLUMN     "parent_tuteur" TEXT NOT NULL,
ADD COLUMN     "recherche_normalisee" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sexe" "Sexe" NOT NULL,
ADD COLUMN     "telephone" TEXT NOT NULL,
ALTER COLUMN "date_naissance" SET DATA TYPE DATE,
ALTER COLUMN "lieu_naissance" SET NOT NULL;

-- CreateIndex
CREATE INDEX "eleves_etablissement_id_nom_prenoms_idx" ON "eleves"("etablissement_id", "nom", "prenoms");

-- CreateIndex
CREATE UNIQUE INDEX "eleves_etablissement_id_matricule_key" ON "eleves"("etablissement_id", "matricule");

-- CreateIndex
CREATE UNIQUE INDEX "eleves_etablissement_id_matricule_educ_master_key" ON "eleves"("etablissement_id", "matricule_educ_master");
