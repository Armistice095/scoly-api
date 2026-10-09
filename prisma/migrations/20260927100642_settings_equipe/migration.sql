-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notif_document_genere" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notif_invitation_acceptee" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "nom_complet" DROP NOT NULL,
ALTER COLUMN "telephone" DROP NOT NULL;
