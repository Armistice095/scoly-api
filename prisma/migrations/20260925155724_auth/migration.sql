/*
  Warnings:

  - Added the required column `commune` to the `etablissements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departement` to the `etablissements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ordre_enseignement` to the `etablissements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fonction` to the `utilisateurs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nom_complet` to the `utilisateurs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `telephone` to the `utilisateurs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrdreEnseignement" AS ENUM ('MATERNELLE', 'PRIMAIRE', 'SECONDAIRE');

-- CreateEnum
CREATE TYPE "TypeCodeVerification" AS ENUM ('ACTIVATION_COMPTE', 'RESET_MOT_DE_PASSE');

-- AlterTable
ALTER TABLE "etablissements" ADD COLUMN     "commune" TEXT NOT NULL,
ADD COLUMN     "departement" TEXT NOT NULL,
ADD COLUMN     "ordre_enseignement" "OrdreEnseignement" NOT NULL;

-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "email_verifie_le" TIMESTAMP(3),
ADD COLUMN     "fonction" TEXT NOT NULL,
ADD COLUMN     "nom_complet" TEXT NOT NULL,
ADD COLUMN     "telephone" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "codes_verification" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "type" "TypeCodeVerification" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "utilise_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codes_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codes_verification_utilisateur_id_type_idx" ON "codes_verification"("utilisateur_id", "type");

-- AddForeignKey
ALTER TABLE "codes_verification" ADD CONSTRAINT "codes_verification_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
