import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export interface ErreurChamp {
  /** Nom du champ tel qu'envoyé dans le body (chemin pointé pour un objet imbriqué : `adresse.ville`). */
  champ: string;
  message: string;
}

/**
 * Quand un champ échoue à plusieurs règles à la fois (ex. un nom absent
 * échoue à « obligatoire » ET à « longueur max »), on garde la plus
 * pertinente pour l'utilisateur : « obligatoire » avant « format » avant
 * « longueur ». Un seul message par champ, toujours le même.
 */
const PRIORITE_CONTRAINTES = [
  'whitelistValidation',
  'isNotEmpty',
  'isDefined',
  'isString',
  'isEnum',
  'isBoolean',
  'isInt',
  'isEmail',
  'matches',
  'estDateNaissanceValide',
  'min',
  'max',
  'minLength',
  'maxLength',
];

function choisirMessage(
  champ: string,
  contraintes: Record<string, string>,
): string {
  const cle =
    PRIORITE_CONTRAINTES.find((c) => c in contraintes) ??
    Object.keys(contraintes)[0]!;

  // Message par défaut de class-validator pour un champ non déclaré dans le
  // DTO (forbidNonWhitelisted) : anglais, on le remplace.
  if (cle === 'whitelistValidation') {
    return `Le champ « ${champ} » n'est pas autorisé.`;
  }
  return contraintes[cle]!;
}

/** Aplatit l'arbre d'erreurs de class-validator en une liste `{ champ, message }`, un message par champ. */
export function aplatirErreurs(
  erreurs: ValidationError[],
  prefixe = '',
): ErreurChamp[] {
  return erreurs.flatMap((erreur) => {
    const champ = prefixe ? `${prefixe}.${erreur.property}` : erreur.property;
    const resultat: ErreurChamp[] = [];

    if (erreur.constraints && Object.keys(erreur.constraints).length > 0) {
      resultat.push({
        champ,
        message: choisirMessage(champ, erreur.constraints),
      });
    }
    if (erreur.children?.length) {
      resultat.push(...aplatirErreurs(erreur.children, champ));
    }
    return resultat;
  });
}

/**
 * Réponse 400 de validation. `message` reste un tableau de phrases (format
 * historique, les écrans existants continuent de fonctionner) ; `erreurs`
 * ajoute le nom du champ pour afficher chaque message sous le bon champ.
 */
export function creerExceptionValidation(
  erreurs: ValidationError[],
): BadRequestException {
  return creerExceptionChamps(aplatirErreurs(erreurs));
}

/**
 * Même réponse 400, pour les erreurs détectées « à la main » (règles métier
 * hors DTO). `code` vaut `VALIDATION_ERROR` sauf si un module expose des codes
 * plus précis à son front (ex. `CHAMP_VIDE`, `FORMAT_INVALIDE`).
 */
export function creerExceptionChamps(
  detail: ErreurChamp[],
  code = 'VALIDATION_ERROR',
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code,
    message: detail.map((e) => e.message),
    erreurs: detail,
  });
}
