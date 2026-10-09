import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service.js';
import { nomFichierTelechargement } from '../documents/nom-fichier.js';
import type { DonneesDocument } from '../documents/donnees-document.js';
import { estErreurUnicite } from '../eleves/eleves.mapper.js';
import { motsDeRecherche } from '../eleves/utils/recherche.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { AnnulerDocumentDto } from './dto/annuler-document.dto.js';
import type { ListerArchivesQueryDto } from './dto/lister-archives-query.dto.js';
import {
  POUR_DETAIL,
  POUR_LISTE,
  versDetail,
  versLigne,
} from './archives.mapper.js';

@Injectable()
export class ArchivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
  ) {}

  // -------------------------------------------------------------------------
  // Liste : GET /archives
  // -------------------------------------------------------------------------

  async lister(etablissementId: string, query: ListerArchivesQueryDto) {
    const { page, limit } = query;
    const where = this.construireFiltre(etablissementId, query);
    // Même ordre que l'index (etablissement, created_at DESC, id DESC), lu à
    // l'endroit ou à rebours. `id` départage deux documents au même instant :
    // sans lui, la pagination pourrait répéter ou sauter une ligne.
    const sens = query.tri === 'ancien' ? 'asc' : 'desc';

    const [total, documents] = await this.prisma.$transaction([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        orderBy: [{ createdAt: sens }, { id: sens }],
        skip: (page - 1) * limit,
        take: limit,
        ...POUR_LISTE,
      }),
    ]);

    return {
      data: documents.map(versLigne),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // -------------------------------------------------------------------------
  // Fiche : GET /archives/:id
  // -------------------------------------------------------------------------

  async recuperer(etablissementId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      // Toujours l'établissement du JWT, jamais juste l'id : un document d'un
      // autre établissement répond 404, comme s'il n'existait pas.
      where: { id: documentId, etablissementId },
      ...POUR_DETAIL,
    });
    if (!document) throw new NotFoundException('Document introuvable.');
    return versDetail(document);
  }

  // -------------------------------------------------------------------------
  // Annulation : POST /archives/:id/annulation
  // -------------------------------------------------------------------------

  /**
   * Annule un document : statut ANNULE + enregistrement (qui, quand, pourquoi),
   * dans une seule transaction. Irréversible, et le numéro reste attribué.
   *
   * Pas de « lire puis écrire » : l'UPDATE conditionnel (statut = ACTIF) est
   * atomique. Si deux personnes annulent en même temps, une seule passe ; l'autre
   * reçoit 409 DOCUMENT_DEJA_ANNULE. La base refuse de toute façon une
   * réactivation ou un second enregistrement d'annulation (trigger + unicité).
   */
  async annuler(
    etablissementId: string,
    utilisateurId: string,
    documentId: string,
    dto: AnnulerDocumentDto,
  ) {
    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const maj = await tx.document.updateMany({
          where: { id: documentId, etablissementId, statut: 'ACTIF' },
          data: { statut: 'ANNULE' },
        });

        if (maj.count === 0) {
          // Soit il n'existe pas (ou pas chez nous), soit il est déjà annulé.
          const existant = await tx.document.findFirst({
            where: { id: documentId, etablissementId },
            select: { id: true },
          });
          if (!existant) throw new NotFoundException('Document introuvable.');
          throw this.dejaAnnule();
        }

        await tx.annulation.create({
          data: { documentId, motif: dto.motif, annuleParId: utilisateurId },
        });
      });
    } catch (erreur) {
      if (estErreurUnicite(erreur)) throw this.dejaAnnule();
      throw erreur;
    }

    const fiche = await this.recuperer(etablissementId, documentId);
    // Seulement ici : une annulation qui échoue (404 / 409) ne notifie personne.
    await this.notifications.documentAnnule({
      etablissementId,
      auteurId: utilisateurId,
      documentId,
      typeDocumentNom: fiche.typeDocument.nom,
      eleveNomComplet: fiche.eleve.nomComplet,
    });
    return fiche;
  }

  // -------------------------------------------------------------------------
  // PDF : téléchargement (tracé) et aperçu (non tracé)
  // -------------------------------------------------------------------------

  /** Lien signé de téléchargement. Même règle que GET /documents/:id/telechargement : tracé, refusé si annulé. */
  urlTelechargement(
    etablissementId: string,
    utilisateurId: string,
    documentId: string,
  ) {
    return this.documents.urlTelechargement(
      etablissementId,
      utilisateurId,
      documentId,
    );
  }

  /**
   * Octets du PDF pour l'affichage dans l'application (« Voir l'aperçu »).
   * Autorisé aussi pour un document annulé (on peut le consulter, pas le
   * télécharger), et non tracé : consulter n'est pas obtenir le fichier.
   */
  async apercu(
    etablissementId: string,
    documentId: string,
  ): Promise<{ pdf: Buffer; nomFichier: string }> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, etablissementId },
      select: {
        urlPdf: true,
        donneesFigees: true,
        typeDocument: { select: { nom: true } },
      },
    });
    if (!document?.urlPdf) throw new NotFoundException('Document introuvable.');

    const pdf = await this.storage.telecharger(document.urlPdf);
    if (!pdf) {
      throw new NotFoundException(
        'Le fichier PDF de ce document est introuvable.',
      );
    }

    const { eleve } = document.donneesFigees as unknown as DonneesDocument;
    return {
      pdf,
      nomFichier: nomFichierTelechargement(
        document.typeDocument.nom,
        eleve.nom,
        eleve.prenoms,
      ),
    };
  }

  // -------------------------------------------------------------------------
  // Internes
  // -------------------------------------------------------------------------

  private construireFiltre(
    etablissementId: string,
    query: ListerArchivesQueryDto,
  ): Prisma.DocumentWhereInput {
    // « adjovi 0024 » : chaque mot doit se retrouver dans le texte de recherche
    // du document (référence + identité figée de l'élève), sans accents ni casse.
    // Les mots ne contiennent que [a-z0-9] : aucun joker LIKE à échapper.
    const mots = motsDeRecherche(query.search ?? '');

    return {
      etablissementId,
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.typeDocumentId ? { typeDocumentId: query.typeDocumentId } : {}),
      ...(query.eleveId ? { eleveId: query.eleveId } : {}),
      ...(mots.length > 0
        ? {
            AND: mots.map((mot) => ({
              rechercheNormalisee: { contains: mot },
            })),
          }
        : {}),
    };
  }

  private dejaAnnule() {
    return new ConflictException({
      message: 'Ce document est déjà annulé.',
      code: 'DOCUMENT_DEJA_ANNULE',
    });
  }
}
