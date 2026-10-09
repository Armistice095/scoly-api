import { DUREE_INVITATION_JOURS } from '../../verification/durees.js';
import {
  bouton,
  encart,
  enGras,
  mettreEnPageEmail,
  paragraphe,
  paragrapheHtml,
  signature,
  titreSection,
} from './mise-en-page.js';

const LIBELLE_BOUTON = 'Créer mon mot de passe et activer mon compte';

/**
 * Construit le contenu de l'e-mail d'invitation (lien, pas un code) envoyé
 * à un membre invité par le Directeur d'un établissement (seul rôle autorisé
 * à inviter, d'où « Le Directeur » dans le texte).
 *
 * `etablissementNom` et `fonction` sont saisis par des utilisateurs : ils sont
 * échappés partout où ils entrent dans le HTML.
 */
export function genererEmailInvitation(
  lien: string,
  etablissementNom: string,
  fonction: string,
) {
  const sujet = `Invitation à rejoindre ${etablissementNom} sur Scoly`;
  const validite = `ce lien d’activation est valable pendant ${DUREE_INVITATION_JOURS} jours. Passé ce délai, vous devrez demander au Directeur de votre établissement de vous envoyer une nouvelle invitation.`;
  const ignorer =
    'Si vous n’êtes pas à l’origine de cette demande ou si vous ne reconnaissez pas cet établissement, vous pouvez simplement ignorer cet e-mail. Aucun compte ne sera activé sans votre action.';

  const texte = [
    'Bonjour,',
    '',
    `Vous êtes invité(e) à rejoindre ${etablissementNom} sur Scoly.`,
    `Le Directeur de votre établissement vous a invité(e) à rejoindre son espace Scoly en tant que ${fonction}.`,
    'Scoly vous permettra d’accéder à l’espace de votre établissement et d’utiliser les fonctionnalités qui vous sont attribuées selon votre rôle.',
    '',
    'Votre compte est presque prêt',
    'Pour commencer, il vous suffit de créer votre mot de passe et d’activer votre compte en cliquant sur le lien ci-dessous :',
    '',
    lien,
    '',
    `Important : ${validite}`,
    '',
    ignorer,
    '',
    'Bienvenue sur Scoly,',
    'L’équipe Scoly',
  ].join('\n');

  const html = mettreEnPageEmail({
    titre: sujet,
    apercu: `Créez votre mot de passe pour activer votre compte. Lien valable ${DUREE_INVITATION_JOURS} jours.`,
    contenu: [
      paragraphe('Bonjour,'),
      paragrapheHtml(
        `Vous êtes invité(e) à rejoindre ${enGras(etablissementNom)} sur Scoly.`,
      ),
      paragrapheHtml(
        `Le Directeur de votre établissement vous a invité(e) à rejoindre son espace Scoly en tant que ${enGras(fonction)}.`,
      ),
      paragraphe(
        'Scoly vous permettra d’accéder à l’espace de votre établissement et d’utiliser les fonctionnalités qui vous sont attribuées selon votre rôle.',
      ),
      titreSection('Votre compte est presque prêt'),
      paragraphe(
        'Pour commencer, il vous suffit de créer votre mot de passe et d’activer votre compte en cliquant sur le bouton ci-dessous :',
      ),
      bouton(LIBELLE_BOUTON, lien),
      encart('Important :', validite),
      paragraphe(ignorer, { discret: true }),
      signature('Bienvenue sur Scoly,'),
    ].join('\n'),
  });

  return { sujet, html, texte };
}
