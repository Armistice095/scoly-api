import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { CODES_ERREUR } from './constantes.js';

/**
 * Erreurs de la page publique :
 *  - les `HttpException` (400, 429…) passent telles quelles, leur forme est déjà celle du contrat ;
 *  - tout le reste devient un 500 au `code` stable `ERREUR_SERVEUR` et au message
 *    lisible par un visiteur, sans détail technique.
 *
 * Journal : seulement le NOM de l'erreur. Le message d'une erreur Prisma peut
 * recopier la requête et ses valeurs (donc la référence saisie, parfois un jeton).
 */
@Catch()
export class ErreursVerificationFilter implements ExceptionFilter {
  private readonly logger = new Logger('VerificationDocument');

  catch(exception: unknown, host: ArgumentsHost): void {
    const reponse = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const statut = exception.getStatus();
      const corps = exception.getResponse();
      // 429 : en-tête standard, que tout client HTTP sait lire (le limiteur
      // n'en pose qu'une variante suffixée, propre à chaque compteur nommé).
      const attente = (corps as { retryAfterSecondes?: unknown })
        .retryAfterSecondes;
      if (statut === 429 && typeof attente === 'number') {
        reponse.setHeader('Retry-After', String(attente));
      }
      reponse
        .status(statut)
        .json(
          typeof corps === 'string'
            ? { statusCode: statut, message: corps }
            : corps,
        );
      return;
    }

    this.logger.error(
      `Erreur interne pendant une vérification (${exception instanceof Error ? exception.name : typeof exception}).`,
    );
    reponse.status(500).json({
      statusCode: 500,
      code: CODES_ERREUR.ERREUR_SERVEUR,
      message:
        'Le service de vérification est momentanément indisponible. Veuillez réessayer dans quelques instants.',
    });
  }
}
