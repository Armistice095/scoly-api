import { randomBytes, randomInt } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { TypeCodeVerification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { DUREE_EXPIRATION_MINUTES, DUREE_INVITATION_JOURS } from './durees.js';

/** Délai minimum entre deux envois du même type de code, en secondes. */
const DUREE_COOLDOWN_SECONDES = 60;
/** Nombre d'essais autorisés pour un même code avant qu'il ne soit invalidé. */
const NOMBRE_TENTATIVES_MAX = 5;
const TOURS_BCRYPT = 10;

/**
 * Génère, envoie (via le hash stocké) et vérifie les codes à 6 chiffres
 * utilisés pour l'activation de compte et la réinitialisation de mot de
 * passe. Ne connaît rien à Brevo/e-mail : c'est AuthService qui orchestre
 * VerificationService + MailService.
 */
@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un nouveau code, l'enregistre en base (hashé) et renvoie le code
   * en clair — à charge de l'appelant de l'envoyer immédiatement par e-mail
   * (le code en clair n'est jamais conservé ni loggé).
   *
   * Rejette la demande avec un 429 si le cooldown depuis le dernier envoi
   * de ce type n'est pas écoulé.
   */
  async genererCode(
    utilisateurId: string,
    type: TypeCodeVerification,
  ): Promise<string> {
    const dernierCode = await this.prisma.codeVerification.findFirst({
      where: { utilisateurId, type },
      orderBy: { createdAt: 'desc' },
    });

    if (dernierCode) {
      const ageSecondes = (Date.now() - dernierCode.createdAt.getTime()) / 1000;
      if (ageSecondes < DUREE_COOLDOWN_SECONDES) {
        const attente = Math.ceil(DUREE_COOLDOWN_SECONDES - ageSecondes);
        throw new HttpException(
          `Veuillez patienter ${attente} seconde(s) avant de redemander un code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = randomInt(100_000, 1_000_000).toString();
    const codeHash = await bcrypt.hash(code, TOURS_BCRYPT);
    const expireLe = new Date(Date.now() + DUREE_EXPIRATION_MINUTES * 60_000);

    await this.prisma.codeVerification.create({
      data: { utilisateurId, type, codeHash, expireLe },
    });

    return code;
  }

  /**
   * Vérifie le code saisi pour le type donné et, s'il est valide, le
   * marque comme utilisé (il ne pourra plus resservir).
   *
   * Le message d'erreur reste volontairement générique ("code invalide ou
   * expiré") dans tous les cas d'échec — code faux, expiré, déjà utilisé ou
   * inexistant — pour ne pas donner d'indice exploitable à un attaquant.
   */
  async verifierCode(
    utilisateurId: string,
    type: TypeCodeVerification,
    codeSaisi: string,
  ): Promise<void> {
    const dernierCode = await this.prisma.codeVerification.findFirst({
      where: { utilisateurId, type, utiliseLe: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!dernierCode || dernierCode.expireLe < new Date()) {
      throw new BadRequestException('Code invalide ou expiré.');
    }

    if (dernierCode.tentatives >= NOMBRE_TENTATIVES_MAX) {
      throw new BadRequestException(
        'Trop de tentatives. Merci de demander un nouveau code.',
      );
    }

    const estValide = await bcrypt.compare(codeSaisi, dernierCode.codeHash);

    if (!estValide) {
      await this.prisma.codeVerification.update({
        where: { id: dernierCode.id },
        data: { tentatives: { increment: 1 } },
      });
      throw new BadRequestException('Code invalide ou expiré.');
    }

    await this.prisma.codeVerification.update({
      where: { id: dernierCode.id },
      data: { utiliseLe: new Date() },
    });
  }

  /**
   * Génère un jeton d'invitation (256 bits, hex) — pas un code à 6 chiffres :
   * il part dans un lien cliqué, pas saisi à la main. Renvoie l'id de la
   * ligne CodeVerification (safe à mettre dans l'URL, c'est un UUID
   * aléatoire) et le jeton en clair, à concaténer dans le lien d'invitation.
   * Respecte le même cooldown que genererCode pour éviter de spammer la
   * boîte mail de l'invité si on martèle "renvoyer l'invitation".
   */
  async genererTokenInvitation(
    utilisateurId: string,
  ): Promise<{ id: string; token: string }> {
    const dernier = await this.prisma.codeVerification.findFirst({
      where: { utilisateurId, type: 'INVITATION_EQUIPE' },
      orderBy: { createdAt: 'desc' },
    });

    if (dernier) {
      const ageSecondes = (Date.now() - dernier.createdAt.getTime()) / 1000;
      if (ageSecondes < DUREE_COOLDOWN_SECONDES) {
        const attente = Math.ceil(DUREE_COOLDOWN_SECONDES - ageSecondes);
        throw new HttpException(
          `Veuillez patienter ${attente} seconde(s) avant de renvoyer l'invitation.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const token = randomBytes(32).toString('hex');
    const codeHash = await bcrypt.hash(token, TOURS_BCRYPT);
    const expireLe = new Date(
      Date.now() + DUREE_INVITATION_JOURS * 24 * 60 * 60_000,
    );

    const ligne = await this.prisma.codeVerification.create({
      data: { utilisateurId, type: 'INVITATION_EQUIPE', codeHash, expireLe },
    });

    return { id: ligne.id, token };
  }

  /**
   * Vérifie un jeton d'invitation sans le consommer — pour l'écran d'aperçu
   * affiché avant que la personne ait choisi son mot de passe (on veut
   * pouvoir lui montrer "vous êtes invité(e) par X" sans griller le jeton).
   */
  async consulterTokenInvitation(id: string, token: string): Promise<string> {
    const ligne = await this.trouverLigneInvitationValide(id, token);
    return ligne.utilisateurId;
  }

  /**
   * Vérifie un jeton d'invitation identifié par l'id de sa ligne
   * CodeVerification (fourni dans le lien avec le jeton — on ne peut pas
   * retrouver la ligne par bcrypt.compare seul, il faut savoir laquelle
   * comparer) et le marque comme utilisé. Pas de compteur de tentatives
   * ici : avec 256 bits d'entropie, le brute-force n'est pas un scénario
   * réaliste, contrairement au code à 6 chiffres.
   */
  async verifierTokenInvitation(id: string, token: string): Promise<string> {
    const ligne = await this.trouverLigneInvitationValide(id, token);

    await this.prisma.codeVerification.update({
      where: { id: ligne.id },
      data: { utiliseLe: new Date() },
    });

    return ligne.utilisateurId;
  }

  private async trouverLigneInvitationValide(id: string, token: string) {
    const ligne = await this.prisma.codeVerification.findFirst({
      where: { id, type: 'INVITATION_EQUIPE', utiliseLe: null },
    });

    if (!ligne || ligne.expireLe < new Date()) {
      throw new BadRequestException(
        'Ce lien d’invitation est invalide ou a expiré.',
      );
    }

    const estValide = await bcrypt.compare(token, ligne.codeHash);
    if (!estValide) {
      throw new BadRequestException(
        'Ce lien d’invitation est invalide ou a expiré.',
      );
    }

    return ligne;
  }
}
