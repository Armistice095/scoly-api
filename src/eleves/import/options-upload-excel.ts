import { BadRequestException } from '@nestjs/common';
import type {} from 'multer';

const TYPES_MIME_AUTORISES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Certains navigateurs/OS n'envoient pas le type exact pour un .xlsx ; la
  // signature du fichier est de toute façon revérifiée à la lecture.
  'application/octet-stream',
]);
const TAILLE_MAX_OCTETS = 2 * 1024 * 1024; // 2 Mo

export const optionsUploadExcel = {
  limits: { fileSize: TAILLE_MAX_OCTETS, files: 1 },
  fileFilter: (
    _requete: unknown,
    fichier: { mimetype: string; originalname: string },
    callback: (erreur: Error | null, accepter: boolean) => void,
  ) => {
    const extensionValide = fichier.originalname
      .toLowerCase()
      .endsWith('.xlsx');
    if (!extensionValide || !TYPES_MIME_AUTORISES.has(fichier.mimetype)) {
      callback(
        new BadRequestException({
          message:
            'Format non supporté : seul un fichier Excel (.xlsx) est accepté.',
          code: 'FICHIER_INVALIDE',
        }),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
