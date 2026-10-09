/*
  Warnings:

  - You are about to drop the column `template_html` on the `types_documents` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[etablissement_id,numero_unique]` on the table `documents` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[etablissement_id,cle_idempotence]` on the table `documents` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date_emission` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `donnees_figees` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categorie` to the `types_documents` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CategorieDocument" AS ENUM ('SCOLARITE', 'TRANSFERTS_DEPARTS');

-- DropIndex
DROP INDEX "documents_numero_unique_key";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "cle_idempotence" TEXT,
ADD COLUMN     "date_emission" DATE NOT NULL,
ADD COLUMN     "donnees_figees" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "eleves" ADD COLUMN     "classe" TEXT,
ALTER COLUMN "date_inscription" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "types_documents" DROP COLUMN "template_html",
ADD COLUMN     "categorie" "CategorieDocument" NOT NULL,
ADD COLUMN     "ordre" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "actif" SET DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "documents_etablissement_id_numero_unique_key" ON "documents"("etablissement_id", "numero_unique");

-- CreateIndex
CREATE UNIQUE INDEX "documents_etablissement_id_cle_idempotence_key" ON "documents"("etablissement_id", "cle_idempotence");
