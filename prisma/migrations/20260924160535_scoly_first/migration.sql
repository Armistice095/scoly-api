-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "StatutEleve" AS ENUM ('ACTIF', 'TRANSFERE', 'PARTI');

-- CreateEnum
CREATE TYPE "StatutDocument" AS ENUM ('ACTIF', 'ANNULE');

-- CreateTable
CREATE TABLE "etablissements" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "direction_departementale" TEXT,
    "nom_signataire" TEXT,
    "fonction_signataire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etablissements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eleves" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenoms" TEXT NOT NULL,
    "date_naissance" TIMESTAMP(3) NOT NULL,
    "lieu_naissance" TEXT,
    "matricule" TEXT,
    "classe" TEXT NOT NULL,
    "date_inscription" TIMESTAMP(3),
    "statut" "StatutEleve" NOT NULL DEFAULT 'ACTIF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eleves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_documents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "template_html" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "types_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "type_document_id" TEXT NOT NULL,
    "numero_unique" TEXT NOT NULL,
    "champs_saisis" JSONB NOT NULL,
    "statut" "StatutDocument" NOT NULL DEFAULT 'ACTIF',
    "url_pdf" TEXT,
    "qr_code_token" TEXT NOT NULL,
    "remplace_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annulations" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "annule_par_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annulations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE INDEX "utilisateurs_etablissement_id_idx" ON "utilisateurs"("etablissement_id");

-- CreateIndex
CREATE INDEX "eleves_etablissement_id_idx" ON "eleves"("etablissement_id");

-- CreateIndex
CREATE UNIQUE INDEX "types_documents_code_key" ON "types_documents"("code");

-- CreateIndex
CREATE UNIQUE INDEX "documents_numero_unique_key" ON "documents"("numero_unique");

-- CreateIndex
CREATE UNIQUE INDEX "documents_qr_code_token_key" ON "documents"("qr_code_token");

-- CreateIndex
CREATE UNIQUE INDEX "documents_remplace_document_id_key" ON "documents"("remplace_document_id");

-- CreateIndex
CREATE INDEX "documents_etablissement_id_idx" ON "documents"("etablissement_id");

-- CreateIndex
CREATE INDEX "documents_eleve_id_idx" ON "documents"("eleve_id");

-- CreateIndex
CREATE INDEX "documents_statut_idx" ON "documents"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "annulations_document_id_key" ON "annulations"("document_id");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_type_document_id_fkey" FOREIGN KEY ("type_document_id") REFERENCES "types_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_remplace_document_id_fkey" FOREIGN KEY ("remplace_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations" ADD CONSTRAINT "annulations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations" ADD CONSTRAINT "annulations_annule_par_id_fkey" FOREIGN KEY ("annule_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
