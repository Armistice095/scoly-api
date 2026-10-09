import { BadRequestException } from '@nestjs/common';
// Import "à vide" : uniquement pour charger la déclaration globale
// Express.Multer.File de @types/multer (le tsconfig du projet restreint les
// types ambiants auto-inclus à node/vitest — sans cet import explicite,
// `Express.Multer.File` n'existe pour aucun fichier du projet).
import type {} from 'multer';

const TYPES_MIME_AUTORISES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const TAILLE_MAX_OCTETS = 2 * 1024 * 1024; // 2 Mo

export const optionsUploadImage = {
  limits: { fileSize: TAILLE_MAX_OCTETS },
  fileFilter: (
    _requete: unknown,
    fichier: { mimetype: string },
    callback: (erreur: Error | null, accepter: boolean) => void,
  ) => {
    if (!TYPES_MIME_AUTORISES.has(fichier.mimetype)) {
      callback(
        new BadRequestException(
          'Format d’image non supporté (PNG, JPEG ou WebP uniquement).',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

/** Extension de fichier à utiliser dans le chemin de stockage, déduite du mimetype (jamais du nom d'origine envoyé par le client). */
export function extensionDepuisMime(mimetype: string): string {
  switch (mimetype) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}
