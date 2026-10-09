import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

const ROUTE_VERIFICATION = /^\/verification\/?(?:\?|$)/;

const liste = (valeur: string) =>
  valeur
    .split(',')
    .map((origine) => origine.trim())
    .filter((origine) => origine !== '');

/**
 * Options CORS selon l'URL demandée.
 *
 * - Partout ailleurs : inchangé (une origine, cookies/credentials autorisés).
 * - `/verification` : uniquement les origines de la page de vérification,
 *   méthode POST seule, en-tête Content-Type seul, et SANS credentials : cette
 *   route n'a besoin d'aucun cookie ni jeton, autant ne jamais en accepter.
 *   `VERIFICATION_CORS_ORIGIN` (séparées par des virgules) prime sur `CORS_ORIGIN`.
 */
export function optionsCors(
  url: string | undefined,
  env: { CORS_ORIGIN?: string; VERIFICATION_CORS_ORIGIN?: string },
): CorsOptions {
  const origineApp = env.CORS_ORIGIN ?? 'http://localhost:5173';

  if (url !== undefined && ROUTE_VERIFICATION.test(url)) {
    return {
      origin: liste(env.VERIFICATION_CORS_ORIGIN ?? origineApp),
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      credentials: false,
      maxAge: 600,
    };
  }
  return { origin: origineApp, credentials: true };
}

/**
 * Valeur de `TRUST_PROXY` pour Express (`app.set('trust proxy', …)`).
 *
 * Sans proxy de confiance, `req.ip` est l'adresse du proxy d'hébergement : tous
 * les visiteurs partageraient le même quota. Avec un proxy de confiance mal
 * réglé, n'importe qui peut forger `X-Forwarded-For` et contourner la limite.
 * D'où : jamais de confiance par défaut, et un nombre de sauts explicite.
 *
 *  - absent / `false` / `0` → pas de proxy (valeur par défaut)
 *  - `1`, `2`… → nombre de proxys de confiance devant l'API
 *  - `true` → refusé (confiance totale = IP forgeable)
 *  - autre texte → sous-réseaux/mots-clés Express (`loopback`, `10.0.0.0/8`…)
 */
export function lireTrustProxy(
  valeur: string | undefined,
): boolean | number | string {
  const texte = valeur?.trim();
  if (!texte || texte === 'false' || texte === '0') return false;
  if (/^\d+$/.test(texte)) return Number(texte);
  if (texte === 'true') {
    throw new Error(
      'TRUST_PROXY=true fait confiance à tous les en-têtes X-Forwarded-For : indiquez le nombre de proxys (ex. 1).',
    );
  }
  return texte;
}
