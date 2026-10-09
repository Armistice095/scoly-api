import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { Utilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { VerificationService } from '../verification/verification.service.js';
import { AuthService } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { InviterDto } from './dto/inviter.dto.js';
import type { AccepterInvitationDto } from './dto/accepter-invitation.dto.js';

const TOURS_BCRYPT = 10;

@Injectable()
export class EquipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly verification: VerificationService,
    private readonly authService: AuthService,
    private readonly notifications: NotificationsService,
  ) {}

  async lister(etablissementId: string) {
    const utilisateurs = await this.prisma.utilisateur.findMany({
      where: { etablissementId },
      orderBy: { createdAt: 'asc' },
    });

    return utilisateurs.map((utilisateur: Utilisateur) => ({
      id: utilisateur.id,
      nomComplet: utilisateur.nomComplet,
      fonction: utilisateur.fonction,
      email: utilisateur.email,
      role: utilisateur.role,
      // En attente = invité mais jamais activé. Actif/Désactivé ne
      // s'appliquent qu'une fois le compte activé.
      statut: !utilisateur.emailVerifieLe
        ? 'EN_ATTENTE'
        : utilisateur.actif
          ? 'ACTIF'
          : 'DESACTIVE',
    }));
  }

  async inviter(etablissementId: string, dto: InviterDto) {
    const existant = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });
    if (existant) {
      throw new ConflictException('Un compte existe déjà avec cet e-mail.');
    }

    const etablissement = await this.prisma.etablissement.findUniqueOrThrow({
      where: { id: etablissementId },
    });

    const utilisateur = await this.prisma.utilisateur.create({
      data: {
        etablissementId,
        email: dto.email,
        fonction: dto.fonction,
        // nomComplet, telephone, motDePasseHash : inconnus tant que la
        // personne n'a pas accepté — remplis par accepterInvitation.
      },
    });

    await this.envoyerInvitation(
      utilisateur.id,
      utilisateur.email,
      dto.fonction,
      etablissement.nom,
    );

    return {
      id: utilisateur.id,
      email: utilisateur.email,
      fonction: utilisateur.fonction,
      statut: 'EN_ATTENTE',
    };
  }

  async renvoyerInvitation(
    etablissementId: string,
    utilisateurId: string,
  ): Promise<{ message: string }> {
    const utilisateur = await this.trouverMembreOuEchouer(
      etablissementId,
      utilisateurId,
    );

    if (utilisateur.emailVerifieLe) {
      throw new BadRequestException('Ce compte est déjà activé.');
    }

    const etablissement = await this.prisma.etablissement.findUniqueOrThrow({
      where: { id: etablissementId },
    });
    await this.envoyerInvitation(
      utilisateur.id,
      utilisateur.email,
      utilisateur.fonction,
      etablissement.nom,
    );

    return { message: 'Invitation renvoyée.' };
  }

  async changerActivation(
    etablissementId: string,
    utilisateurId: string,
    actif: boolean,
  ) {
    const utilisateur = await this.trouverMembreOuEchouer(
      etablissementId,
      utilisateurId,
    );

    // Le Directeur est unique par établissement et ne se désactive jamais
    // par ce biais (il faudrait d'abord un transfert de rôle, pas encore
    // construit).
    if (utilisateur.role === 'DIRECTEUR') {
      throw new BadRequestException(
        'Le compte Directeur ne peut pas être désactivé.',
      );
    }

    const misAJour = await this.prisma.utilisateur.update({
      where: { id: utilisateurId },
      data: { actif },
    });

    return {
      id: misAJour.id,
      nomComplet: misAJour.nomComplet,
      fonction: misAJour.fonction,
      email: misAJour.email,
      role: misAJour.role,
      statut: !misAJour.emailVerifieLe
        ? 'EN_ATTENTE'
        : misAJour.actif
          ? 'ACTIF'
          : 'DESACTIVE',
    };
  }

  /** Aperçu avant acceptation (public) : ne consomme pas le jeton. */
  async consulterInvitation(id: string, token: string) {
    const utilisateurId = await this.verification.consulterTokenInvitation(
      id,
      token,
    );
    const utilisateur = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
      include: { etablissement: true },
    });

    return {
      email: utilisateur.email,
      fonction: utilisateur.fonction,
      etablissementNom: utilisateur.etablissement.nom,
    };
  }

  /** Accepte l'invitation : consomme le jeton, complète le profil, active le compte et connecte automatiquement. */
  async accepterInvitation(dto: AccepterInvitationDto) {
    if (dto.motDePasse !== dto.confirmationMotDePasse) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    const utilisateurId = await this.verification.verifierTokenInvitation(
      dto.id,
      dto.token,
    );
    const motDePasseHash = await bcrypt.hash(dto.motDePasse, TOURS_BCRYPT);

    const membre = await this.prisma.utilisateur.update({
      where: { id: utilisateurId },
      data: {
        nomComplet: dto.nomComplet,
        telephone: dto.telephone,
        motDePasseHash,
        emailVerifieLe: new Date(),
      },
    });

    // Ne lève jamais : l'invitation est acceptée, la notification est un plus.
    await this.notifications.invitationAcceptee({
      etablissementId: membre.etablissementId,
      membreId: membre.id,
      membreLibelle: membre.nomComplet?.trim() || membre.email,
      fonction: membre.fonction,
    });

    return this.authService.connecterUtilisateurParId(utilisateurId);
  }

  private async envoyerInvitation(
    utilisateurId: string,
    email: string,
    fonction: string,
    etablissementNom: string,
  ): Promise<void> {
    const { id, token } =
      await this.verification.genererTokenInvitation(utilisateurId);
    const lien = `${process.env.FRONT_URL ?? 'http://localhost:5173'}/invitation?id=${id}&token=${token}`;
    await this.mail.envoyerInvitation(email, lien, etablissementNom, fonction);
  }

  // Toujours filtrer par etablissementId, jamais juste par id : empêche un
  // Directeur d'un établissement d'agir sur les utilisateurs d'un autre.
  private async trouverMembreOuEchouer(
    etablissementId: string,
    utilisateurId: string,
  ) {
    const utilisateur = await this.prisma.utilisateur.findFirst({
      where: { id: utilisateurId, etablissementId },
    });
    if (!utilisateur) {
      throw new BadRequestException('Utilisateur introuvable.');
    }
    return utilisateur;
  }
}
