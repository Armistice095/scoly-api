import {
  HttpException,
  HttpStatus,
  Injectable,
  type ExecutionContext,
} from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerOptions,
} from '@nestjs/throttler';
import { CODES_ERREUR, LIMITES } from './constantes.js';

/**
 * Canal de la requête, déduit du corps (déjà parsé quand les guards s'exécutent).
 * Doit rester cohérent avec lireRequete() : un jeton non vide = QR, le reste
 * (dont un corps vide) = saisie, le canal le plus surveillé.
 */
export function canalDeLaRequete(contexte: ExecutionContext): 'QR' | 'SAISIE' {
  const corps = contexte.switchToHttp().getRequest<{ body?: unknown }>().body;
  const token = (corps as { token?: unknown } | undefined)?.token;
  return typeof token === 'string' && token.trim() !== '' ? 'QR' : 'SAISIE';
}

const pour = (
  canal: 'QR' | 'SAISIE',
  nom: string,
  { limite, ttl, blocage }: { limite: number; ttl: number; blocage: number },
): ThrottlerOptions => ({
  name: nom,
  limit: limite,
  ttl,
  blockDuration: blocage,
  skipIf: (contexte) => canalDeLaRequete(contexte) !== canal,
});

/** Quatre compteurs par IP : saisie et QR, à la minute et à l'heure. */
export const THROTTLERS_VERIFICATION: ThrottlerOptions[] = [
  pour('SAISIE', 'saisie-minute', LIMITES.saisie.minute),
  pour('SAISIE', 'saisie-heure', LIMITES.saisie.heure),
  pour('QR', 'qr-minute', LIMITES.qr.minute),
  pour('QR', 'qr-heure', LIMITES.qr.heure),
];

/**
 * Limiteur de débit par IP, propre à la page publique de vérification.
 * Compteurs en MÉMOIRE : valables pour une instance. En multi-instances, le
 * ralentissement progressif sur échecs (en base) reste partagé ; pour partager
 * aussi ces compteurs, fournir un `storage` Redis à ThrottlerModule.
 */
@Injectable()
export class LimiteVerificationGuard extends ThrottlerGuard {
  /** Même enveloppe d'erreur que le reste de l'API, avec `code` stable pour le front. */
  protected override async throwThrottlingException(
    _contexte: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: CODES_ERREUR.TROP_DE_REQUETES,
        message:
          'Trop de vérifications en peu de temps. Veuillez patienter avant de réessayer.',
        retryAfterSecondes: Math.max(1, Math.ceil(detail.timeToBlockExpire)),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
