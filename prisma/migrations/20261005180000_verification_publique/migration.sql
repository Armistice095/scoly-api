/*
  Vérification publique des documents.

  1. documents.reference_normalisee : clé de recherche de la page publique
     (référence normalisée, cf. src/documents/reference-normalisee.ts). Colonne
     NULLABLE : les documents déjà émis sont renseignés par le script
         pnpm run verification:backfill
     (la normalisation vit dans le code TypeScript, une seule source de
     vérité ; la recopier en SQL ferait diverger les deux). À lancer juste
     après `prisma migrate deploy` : tant qu'il n'a pas tourné, la saisie
     manuelle ne retrouve pas les anciens documents (le QR, lui, fonctionne
     déjà, il passe par qr_code_token).
     Le trigger d'immuabilité interdit tout UPDATE sur "documents" : le script
     utilise l'échappatoire documentée (SET LOCAL scoly.autoriser_purge).
     Cette migration n'UPDATE rien, elle ne se heurte donc pas au trigger.

  2. journal_verifications : journal anonymisé des vérifications publiques.
*/

-- CreateEnum
CREATE TYPE "CanalVerification" AS ENUM ('QR', 'SAISIE');

-- CreateEnum
CREATE TYPE "ResultatVerification" AS ENUM ('VALIDE', 'ANNULE', 'INTROUVABLE', 'AMBIGU');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "reference_normalisee" TEXT;

-- CreateTable
CREATE TABLE "journal_verifications" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canal" "CanalVerification" NOT NULL,
    "resultat" "ResultatVerification" NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "document_id" TEXT,

    CONSTRAINT "journal_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_reference_normalisee_idx" ON "documents"("reference_normalisee");

-- CreateIndex
CREATE INDEX "journal_verifications_ip_hash_created_at_idx" ON "journal_verifications"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "journal_verifications_created_at_idx" ON "journal_verifications"("created_at");

-- CreateIndex
CREATE INDEX "journal_verifications_document_id_idx" ON "journal_verifications"("document_id");

-- AddForeignKey
ALTER TABLE "journal_verifications" ADD CONSTRAINT "journal_verifications_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
