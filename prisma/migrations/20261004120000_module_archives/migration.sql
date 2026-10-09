/*
  Module Archives.

  - documents.etabli_par_id : auteur du document. Les documents déjà présents
    (tests, avant mise en ligne) sont rattachés au Directeur de leur
    établissement (à défaut, à son plus ancien utilisateur), puis la colonne
    devient obligatoire.
  - documents.numero_ordre : le « N » seul de la référence. Reste NULL pour les
    documents antérieurs (aucun calcul fiable possible depuis le texte).
  - documents.recherche_normalisee : texte de recherche des archives, rempli
    ici pour l'existant (même règle que normaliserPourRecherche : minuscules,
    sans accents, tout ce qui n'est pas lettre ou chiffre devient un espace).
  - annulations -> documents : ON DELETE RESTRICT (on ne supprime plus rien).
  - Nouvelle table telechargements_documents (journal en ajout seul).
  - Index de la liste des archives (remplacent documents_etablissement_id_idx
    et documents_statut_idx, devenus redondants / peu sélectifs).
*/

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "etabli_par_id" TEXT,
ADD COLUMN     "numero_ordre" INTEGER,
ADD COLUMN     "recherche_normalisee" TEXT NOT NULL DEFAULT '';

-- Reprise de l'existant : auteur
UPDATE "documents" d
SET "etabli_par_id" = (
  SELECT u."id"
  FROM "utilisateurs" u
  WHERE u."etablissement_id" = d."etablissement_id"
  ORDER BY (u."role" = 'DIRECTEUR') DESC, u."created_at" ASC, u."id" ASC
  LIMIT 1
);

-- Reprise de l'existant : texte de recherche
UPDATE "documents"
SET "recherche_normalisee" = btrim(
  regexp_replace(
    lower(
      translate(
        replace(replace(
          concat_ws(' ',
            "numero_unique",
            "donnees_figees" -> 'eleve' ->> 'nom',
            "donnees_figees" -> 'eleve' ->> 'prenoms',
            "donnees_figees" -> 'eleve' ->> 'matricule',
            "donnees_figees" -> 'eleve' ->> 'matriculeEducMaster'
          ),
          'œ', 'oe'), 'Œ', 'OE'),
        'àâäáãåÀÂÄÁÃÅéèêëÉÈÊËîïíìÎÏÍÌôöóòõÔÖÓÒÕùûüúÙÛÜÚÿŸçÇñÑ',
        'aaaaaaAAAAAAeeeeEEEEiiiiIIIIooooooOOOOOuuuuUUUUyYcCnN'
      )
    ),
    '[^a-z0-9]+', ' ', 'g'
  )
);

-- AlterTable : l'auteur devient obligatoire
ALTER TABLE "documents" ALTER COLUMN "etabli_par_id" SET NOT NULL;

-- DropIndex
DROP INDEX "documents_etablissement_id_idx";

-- DropIndex
DROP INDEX "documents_statut_idx";

-- CreateTable
CREATE TABLE "telechargements_documents" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telechargements_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telechargements_documents_document_id_created_at_idx" ON "telechargements_documents"("document_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "documents_etablissement_id_created_at_id_idx" ON "documents"("etablissement_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "documents_etablissement_id_statut_created_at_idx" ON "documents"("etablissement_id", "statut", "created_at" DESC);

-- CreateIndex
CREATE INDEX "documents_etablissement_id_type_document_id_created_at_idx" ON "documents"("etablissement_id", "type_document_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_etabli_par_id_fkey" FOREIGN KEY ("etabli_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable : une annulation ne disparaît jamais avec son document
ALTER TABLE "annulations" DROP CONSTRAINT "annulations_document_id_fkey";
ALTER TABLE "annulations" ADD CONSTRAINT "annulations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telechargements_documents" ADD CONSTRAINT "telechargements_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telechargements_documents" ADD CONSTRAINT "telechargements_documents_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
