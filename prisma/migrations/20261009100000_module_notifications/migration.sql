/*
  Module Notifications.

  - Une ligne par destinataire (notifications.utilisateur_id) : « lue » est
    personnelle. lue_le NULL = non lue.
  - Supprimées avec l'utilisateur ou l'établissement (CASCADE) : une
    notification n'a aucune valeur d'audit, contrairement aux documents.
  - document_id / membre_id : cibles facultatives, sans clé étrangère.
*/

-- CreateEnum
CREATE TYPE "CategorieNotification" AS ENUM ('DOCUMENTS', 'EQUIPE');

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('DOCUMENT_ETABLI', 'DOCUMENT_ANNULE', 'INVITATION_ACCEPTEE');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "categorie" "CategorieNotification" NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "document_id" TEXT,
    "membre_id" TEXT,
    "lue_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_utilisateur_id_created_at_id_idx" ON "notifications"("utilisateur_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_utilisateur_id_lue_le_idx" ON "notifications"("utilisateur_id", "lue_le");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
