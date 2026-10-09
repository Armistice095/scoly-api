import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListerNotificationsQueryDto } from './dto/lister-notifications-query.dto.js';
import { versNotification } from './notifications.mapper.js';

const INTROUVABLE = 'Notification introuvable.';

/** Ce que les autres modules fournissent pour créer des notifications. */
export interface EvenementDocument {
  etablissementId: string;
  /** Qui a fait l'action : jamais notifié de sa propre action. */
  auteurId: string;
  documentId: string;
  typeDocumentNom: string;
  /** « Prénoms NOM » de l'élève, tel qu'imprimé sur le document. */
  eleveNomComplet: string;
}

export interface EvenementInvitationAcceptee {
  etablissementId: string;
  membreId: string;
  /** Nom de la personne ; à défaut son e-mail. */
  membreLibelle: string;
  fonction: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Lecture (toujours bornée au destinataire : jamais juste l'id)
  // -------------------------------------------------------------------------

  async lister(utilisateurId: string, query: ListerNotificationsQueryDto) {
    const { page, limite } = query;
    const where: Prisma.NotificationWhereInput = {
      utilisateurId,
      ...(query.statut === 'non-lues' ? { lueLe: null } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.categorie ? { categorie: query.categorie } : {}),
    };

    // `id` départage deux notifications au même instant : sans lui, la
    // pagination pourrait répéter ou sauter une ligne.
    const [total, notifications, nonLues] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limite,
        take: limite,
      }),
      this.prisma.notification.count({ where: { utilisateurId, lueLe: null } }),
    ]);

    return {
      data: notifications.map(versNotification),
      meta: {
        total,
        page,
        limite,
        totalPages: Math.ceil(total / limite),
        // Total des non lues de l'utilisateur, tous filtres confondus : met le
        // badge à jour sans second appel.
        nonLues,
      },
    };
  }

  async compteurNonLues(utilisateurId: string) {
    const nonLues = await this.prisma.notification.count({
      where: { utilisateurId, lueLe: null },
    });
    return { nonLues };
  }

  // -------------------------------------------------------------------------
  // Écriture par l'utilisateur : lue / non lue / tout lire / supprimer
  // -------------------------------------------------------------------------

  /** Idempotent : une notification déjà lue garde sa date de lecture d'origine. */
  async marquerLue(utilisateurId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, utilisateurId, lueLe: null },
      data: { lueLe: new Date() },
    });
    return this.recuperer(utilisateurId, id);
  }

  /** Idempotent. */
  async marquerNonLue(utilisateurId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, utilisateurId, lueLe: { not: null } },
      data: { lueLe: null },
    });
    return this.recuperer(utilisateurId, id);
  }

  async toutLire(utilisateurId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { utilisateurId, lueLe: null },
      data: { lueLe: new Date() },
    });
    return { marquees: count };
  }

  async supprimer(utilisateurId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.deleteMany({
      where: { id, utilisateurId },
    });
    if (count === 0) throw new NotFoundException(INTROUVABLE);
  }

  private async recuperer(utilisateurId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, utilisateurId },
    });
    // Inconnue, d'un collègue, d'un autre établissement : même réponse.
    if (!notification) throw new NotFoundException(INTROUVABLE);
    return versNotification(notification);
  }

  // -------------------------------------------------------------------------
  // Production (appelée par les autres modules, jamais exposée en HTTP)
  //
  // Ces méthodes NE LÈVENT JAMAIS : une notification manquée ne doit pas faire
  // échouer l'action métier (un document déjà émis, une invitation déjà
  // acceptée). L'erreur est journalisée, pas propagée.
  // -------------------------------------------------------------------------

  /** Document établi : prévient les collègues qui ont activé « document généré ». */
  async documentEtabli(e: EvenementDocument): Promise<void> {
    await this.diffuser(
      { etablissementId: e.etablissementId, exclureId: e.auteurId },
      { notifDocumentGenere: true },
      {
        type: 'DOCUMENT_ETABLI',
        categorie: 'DOCUMENTS',
        titre: 'Document établi',
        message: `${e.typeDocumentNom} pour ${e.eleveNomComplet}.`,
        documentId: e.documentId,
      },
    );
  }

  /**
   * Document annulé : prévient tous les collègues, sans préférence à
   * respecter — une annulation change la validité d'un document déjà remis.
   */
  async documentAnnule(e: EvenementDocument): Promise<void> {
    await this.diffuser(
      { etablissementId: e.etablissementId, exclureId: e.auteurId },
      {},
      {
        type: 'DOCUMENT_ANNULE',
        categorie: 'DOCUMENTS',
        titre: 'Document annulé',
        message: `${e.typeDocumentNom} pour ${e.eleveNomComplet}.`,
        documentId: e.documentId,
      },
    );
  }

  /** Invitation acceptée : seuls les Directeurs (ceux qui invitent) sont prévenus. */
  async invitationAcceptee(e: EvenementInvitationAcceptee): Promise<void> {
    await this.diffuser(
      {
        etablissementId: e.etablissementId,
        exclureId: e.membreId,
        role: 'DIRECTEUR',
      },
      { notifInvitationAcceptee: true },
      {
        type: 'INVITATION_ACCEPTEE',
        categorie: 'EQUIPE',
        titre: 'Invitation acceptée',
        message: `${e.membreLibelle} a rejoint l'équipe (${e.fonction}).`,
        membreId: e.membreId,
      },
    );
  }

  private async diffuser(
    destinataires: {
      etablissementId: string;
      exclureId: string;
      role?: 'DIRECTEUR' | 'MEMBRE';
    },
    preference: Prisma.UtilisateurWhereInput,
    contenu: Omit<
      Prisma.NotificationUncheckedCreateInput,
      'etablissementId' | 'utilisateurId'
    >,
  ): Promise<void> {
    try {
      const cibles = await this.prisma.utilisateur.findMany({
        where: {
          etablissementId: destinataires.etablissementId,
          id: { not: destinataires.exclureId },
          // Un compte désactivé ou jamais activé ne se connectera pas : inutile.
          actif: true,
          emailVerifieLe: { not: null },
          ...(destinataires.role ? { role: destinataires.role } : {}),
          ...preference,
        },
        select: { id: true },
      });
      if (cibles.length === 0) return;

      await this.prisma.notification.createMany({
        data: cibles.map((c) => ({
          ...contenu,
          etablissementId: destinataires.etablissementId,
          utilisateurId: c.id,
        })),
      });
    } catch (erreur) {
      this.logger.error(
        `Notification ${String(contenu.type)} non créée.`,
        erreur instanceof Error ? erreur.stack : String(erreur),
      );
    }
  }
}
