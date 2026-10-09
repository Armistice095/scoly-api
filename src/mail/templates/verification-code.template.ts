import { DUREE_EXPIRATION_MINUTES } from '../../verification/durees.js';
import {
  blocCode,
  mettreEnPageEmail,
  paragraphe,
  signature,
} from './mise-en-page.js';

export type ContexteCode = 'activation' | 'reset_mot_de_passe';

interface ContenuCode {
  sujet: (code: string) => string;
  apercu: string;
  /** Phrases d'introduction, avant le code (la dernière annonce le code). */
  introduction: string[];
  /** Consigne de sécurité, juste après la durée de validité. */
  securite: string;
  ignorer: string;
  salutation: string;
}

const DUREE = `${DUREE_EXPIRATION_MINUTES} minutes`;

const CONTENUS: Record<ContexteCode, ContenuCode> = {
  activation: {
    // Le code dans l'objet se lit dans l'aperçu de la notification, sans ouvrir l'e-mail.
    sujet: (code) => `${code} est votre code de vérification Scoly`,
    apercu: `Saisissez ce code pour activer votre compte. Il est valable ${DUREE}.`,
    introduction: [
      'Nous vous remercions d’avoir choisi Scoly.',
      'Pour finaliser l’activation de votre compte établissement, veuillez saisir le code de vérification ci-dessous :',
    ],
    securite:
      'Pour votre sécurité, ne le communiquez jamais à qui que ce soit, y compris à une personne se présentant comme l’équipe Scoly.',
    ignorer:
      'Si vous n’êtes pas à l’origine de cette demande, vous pouvez simplement ignorer cet e-mail.',
    salutation: 'À bientôt sur Scoly,',
  },
  reset_mot_de_passe: {
    sujet: (code) => `${code} : réinitialisez votre mot de passe Scoly`,
    apercu: `Saisissez ce code pour réinitialiser votre mot de passe. Il est valable ${DUREE}.`,
    introduction: [
      'Une demande de réinitialisation du mot de passe de votre compte Scoly a été effectuée.',
      'Pour continuer, veuillez saisir le code de vérification ci-dessous :',
    ],
    securite: 'Pour votre sécurité, ne le communiquez à personne.',
    ignorer:
      'Si vous n’êtes pas à l’origine de cette demande, aucune action n’est requise de votre part. Vous pouvez simplement ignorer cet e-mail.',
    salutation: 'À bientôt sur Scoly,',
  },
};

/**
 * Construit le contenu d'un e-mail de code à 6 chiffres pour le contexte
 * donné (activation de compte ou réinitialisation de mot de passe).
 * Le texte brut est fourni en plus du HTML : de nombreux clients mail /
 * filtres anti-spam pénalisent les e-mails qui n'ont que du HTML.
 * Volontairement aucun lien dans ces e-mails : un code à saisir dans
 * l'application est plus sûr et plus difficile à imiter par hameçonnage.
 */
export function genererEmailCode(code: string, contexte: ContexteCode) {
  const c = CONTENUS[contexte];
  const validite = `Ce code est valable pendant ${DUREE}. ${c.securite}`;

  const texte = [
    'Bonjour,',
    '',
    ...c.introduction,
    '',
    code,
    '',
    validite,
    '',
    c.ignorer,
    '',
    c.salutation,
    'L’équipe Scoly',
  ].join('\n');

  const html = mettreEnPageEmail({
    titre: c.sujet(code),
    apercu: c.apercu,
    contenu: [
      paragraphe('Bonjour,'),
      ...c.introduction.map((phrase) => paragraphe(phrase)),
      blocCode(code),
      paragraphe(validite),
      paragraphe(c.ignorer, { discret: true }),
      signature(c.salutation),
    ].join('\n'),
  });

  return { sujet: c.sujet(code), html, texte };
}
