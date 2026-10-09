import { randomBytes } from 'node:crypto';

/** 192 bits d'aléa : non devinable, contrairement au numéro de référence (séquentiel). */
export const OCTETS_TOKEN_QR = 24;

/** Longueur du jeton en base64url (24 octets → 32 caractères, sans remplissage). */
export const LONGUEUR_TOKEN_QR = Math.ceil((OCTETS_TOKEN_QR * 8) / 6);

/**
 * Forme exacte d'un jeton QR émis par Scoly. Sert à rejeter sans toucher la
 * base tout ce qui ne peut pas en être un (page publique de vérification).
 */
export const FORMAT_TOKEN_QR = new RegExp(
  `^[A-Za-z0-9_-]{${LONGUEUR_TOKEN_QR}}$`,
);

/** Jeton porté par le QR code imprimé sur un document : opaque, URL-safe. */
export function genererTokenQr(): string {
  return randomBytes(OCTETS_TOKEN_QR).toString('base64url');
}
