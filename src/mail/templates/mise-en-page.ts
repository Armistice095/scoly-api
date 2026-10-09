/**
 * Mise en page commune aux e-mails Scoly.
 *
 * Règles des e-mails HTML (très différentes du web) : mise en page en tableaux,
 * styles en ligne, aucune image ni police externe (souvent bloquées), largeur
 * fluide jusqu'à 560 px, et fond clair forcé pour éviter les inversions
 * automatiques de couleurs du mode sombre qui rendent le code illisible.
 */

const COULEURS = {
  fond: '#f1f5f9',
  carte: '#ffffff',
  bordure: '#e2e8f0',
  marque: '#1e3a5f',
  accent: '#2563eb',
  texte: '#1e293b',
  discret: '#64748b',
  codeFond: '#eff6ff',
  codeBordure: '#bfdbfe',
} as const;

const POLICE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const POLICE_CODE =
  "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

/**
 * Neutralise le HTML d'une valeur saisie par un utilisateur (nom
 * d'établissement, fonction…) avant de l'insérer dans un e-mail.
 */
export function echapperHtml(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Paragraphe dont le contenu est DÉJÀ du HTML sûr (ex. un nom en gras). Toute
 * valeur saisie par un utilisateur doit y entrer via echapperHtml().
 */
export function paragrapheHtml(
  htmlInterne: string,
  options: { discret?: boolean } = {},
): string {
  const couleur = options.discret ? COULEURS.discret : COULEURS.texte;
  const taille = options.discret ? '14px' : '16px';
  return `<p style="margin:0 0 16px;font-family:${POLICE};font-size:${taille};line-height:1.6;color:${couleur};">${htmlInterne}</p>`;
}

/** Paragraphe de texte courant. Le texte est échappé. */
export function paragraphe(
  texte: string,
  options: { discret?: boolean } = {},
): string {
  return paragrapheHtml(echapperHtml(texte), options);
}

/** Texte en gras (marque) pour une valeur à mettre en avant. Échappé. */
export function enGras(texte: string): string {
  return `<strong style="color:${COULEURS.marque};">${echapperHtml(texte)}</strong>`;
}

/** Titre de section à l'intérieur de la carte. */
export function titreSection(texte: string): string {
  return `<h2 style="margin:28px 0 12px;font-family:${POLICE};font-size:20px;line-height:1.3;font-weight:700;color:${COULEURS.marque};">${echapperHtml(texte)}</h2>`;
}

/**
 * Bouton d'action, construit en tableau avec la couleur de fond sur la cellule
 * ET le lien : il reste un vrai bouton cliquable dans Outlook et Gmail. Sous
 * le bouton, le lien en clair pour les clients qui bloquent les boutons.
 */
export function bouton(libelle: string, lien: string): string {
  const href = echapperHtml(lien);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 16px;">
  <tr>
    <td align="center" bgcolor="${COULEURS.marque}" style="background:${COULEURS.marque};border-radius:10px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${POLICE};font-size:16px;font-weight:700;line-height:1.3;color:#ffffff;text-decoration:none;border-radius:10px;">${echapperHtml(libelle)}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 20px;font-family:${POLICE};font-size:12px;line-height:1.6;color:${COULEURS.discret};text-align:center;">
  Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br>
  <a href="${href}" target="_blank" style="color:${COULEURS.accent};word-break:break-all;overflow-wrap:anywhere;">${echapperHtml(lien)}</a>
</p>`;
}

/** Encart mis en avant (information importante). */
export function encart(titre: string, texte: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
  <tr>
    <td style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;font-family:${POLICE};font-size:15px;line-height:1.6;color:${COULEURS.texte};"><strong>${echapperHtml(titre)}</strong> ${echapperHtml(texte)}</td>
  </tr>
</table>`;
}

/** Le code de vérification, en grand, dans un encadré (d'un seul bloc : se copie tel quel). */
export function blocCode(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td align="center" style="background:${COULEURS.codeFond};border:1px solid ${COULEURS.codeBordure};border-radius:12px;padding:20px 12px;">
      <span style="font-family:${POLICE_CODE};font-size:36px;font-weight:700;letter-spacing:10px;color:${COULEURS.marque};padding-left:10px;user-select:all;-webkit-user-select:all;">${echapperHtml(code)}</span>
    </td>
  </tr>
</table>`;
}

/** Formule de politesse et signature. */
export function signature(formule: string): string {
  return `<p style="margin:24px 0 0;font-family:${POLICE};font-size:16px;line-height:1.6;color:${COULEURS.texte};">${echapperHtml(formule)}<br><strong style="color:${COULEURS.marque};">L’équipe Scoly</strong></p>`;
}

interface OptionsMiseEnPage {
  /** Titre du document (onglet / lecteurs d'écran). */
  titre: string;
  /** Phrase d'aperçu affichée dans la liste des e-mails, à côté de l'objet. */
  apercu: string;
  /** Contenu HTML de la carte (paragraphes, code, signature). */
  contenu: string;
}

export function mettreEnPageEmail({
  titre,
  apercu,
  contenu,
}: OptionsMiseEnPage): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${echapperHtml(titre)}</title>
</head>
<body style="margin:0;padding:0;background:${COULEURS.fond};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${echapperHtml(apercu)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COULEURS.fond};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="padding:0 0 20px;font-family:${POLICE};font-size:30px;font-weight:800;letter-spacing:-0.5px;color:${COULEURS.marque};">
            Scoly<span style="color:${COULEURS.accent};">.</span>
          </td>
        </tr>
        <tr>
          <td style="background:${COULEURS.carte};border:1px solid ${COULEURS.bordure};border-top:4px solid ${COULEURS.marque};border-radius:16px;padding:36px 32px;">
${contenu}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 16px 0;font-family:${POLICE};font-size:12px;line-height:1.6;color:${COULEURS.discret};">
            Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.<br>
            Scoly · Les documents administratifs de votre école, simplement.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
