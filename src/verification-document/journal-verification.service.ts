import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeIp } from '@nestjs/throttler';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CODES_ERREUR,
  ECHECS_SAISIE_MAX,
  FENETRE_ECHECS_MS,
  RETENTION_JOURNAL_JOURS,
  type Canal,
  type Resultat,
} from './constantes.js';

const SECRET_DEV = 'secret-de-developpement-NE-PAS-UTILISER-EN-PRODUCTION';
const UNE_HEURE = 3_600_000;

/**
 * Journal anonymisé des vérifications publiques.
 *
 * Ce qui est enregistré : heure serveur, canal, résultat, IP hachée et, si le
 * document existe, son id. Ce qui ne l'est JAMAIS : IP en clair, référence
 * saisie, jeton QR, nom d'élève, en-têtes, user-agent.
 */
@Injectable()
export class JournalVerificationService {
  private readonly logger = new Logger(JournalVerificationService.name);
  private readonly secret: string;
  private dernierePurge = 0;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('VERIFICATION_LOG_SECRET');
    if (secret && secret.length >= 16) {
      this.secret = secret;
    } else if (config.get<string>('NODE_ENV') === 'production') {
      // Mieux vaut ne pas démarrer que journaliser avec un sel connu de tous.
      throw new Error(
        'VERIFICATION_LOG_SECRET (16 caractères minimum) est obligatoire en production.',
      );
    } else {
      this.logger.warn(
        'VERIFICATION_LOG_SECRET absent : secret de développement utilisé.',
      );
      this.secret = SECRET_DEV;
    }
  }

  /**
   * HMAC-SHA256(IP) tronqué, avec une clé qui change chaque jour (UTC) :
   * pas de réidentification par table arc-en-ciel (l'espace IPv4 est petit) et
   * pas de suivi d'un visiteur d'un jour à l'autre. Les IPv6 sont regroupées
   * par /64 (comme la limitation de débit) : un /64 entier est un seul abonné.
   */
  hacherIp(ip: string | undefined, maintenant: Date = new Date()): string {
    const jour = maintenant.toISOString().slice(0, 10);
    const cle = createHmac('sha256', this.secret).update(jour).digest();
    return createHmac('sha256', cle)
      .update(normalizeIp(ip ?? '') || 'inconnue')
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * Ralentissement progressif de la saisie manuelle : trop d'échecs récents
   * pour cette IP → 429. Lu en base, donc valable même avec plusieurs
   * instances de l'API (contrairement au compteur en mémoire du limiteur).
   */
  async refuserSiTropDEchecs(ipHash: string): Promise<void> {
    const echecs = await this.prisma.journalVerification.count({
      where: {
        ipHash,
        canal: 'SAISIE',
        resultat: { in: ['INTROUVABLE', 'AMBIGU'] },
        createdAt: { gte: new Date(Date.now() - FENETRE_ECHECS_MS) },
      },
    });
    if (echecs >= ECHECS_SAISIE_MAX) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: CODES_ERREUR.TROP_DE_REQUETES,
          message:
            'Trop de références introuvables en peu de temps. Veuillez patienter quelques minutes avant de réessayer.',
          retryAfterSecondes: Math.ceil(FENETRE_ECHECS_MS / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Écrit une ligne. N'échoue jamais vers l'appelant : une panne du journal
   * ne doit pas empêcher quelqu'un de vérifier un document. Les erreurs sont
   * tracées SANS donnée (le message d'erreur Prisma peut citer des valeurs).
   */
  async enregistrer(entree: {
    canal: Canal;
    resultat: Resultat;
    ipHash: string;
    documentId: string | null;
  }): Promise<void> {
    try {
      await this.prisma.journalVerification.create({ data: entree });
      await this.purgerSiNecessaire();
    } catch (erreur) {
      this.logger.warn(
        `Journal de vérification non écrit (${erreur instanceof Error ? erreur.name : 'erreur inconnue'}).`,
      );
    }
  }

  /** Au plus une purge par heure et par instance : pas besoin d'un ordonnanceur. */
  private async purgerSiNecessaire(): Promise<void> {
    const maintenant = Date.now();
    if (maintenant - this.dernierePurge < UNE_HEURE) return;
    this.dernierePurge = maintenant;
    await this.prisma.journalVerification.deleteMany({
      where: {
        createdAt: {
          lt: new Date(maintenant - RETENTION_JOURNAL_JOURS * 86_400_000),
        },
      },
    });
  }
}
