import PDFDocument from 'pdfkit';
import { infosTitre } from '../../etablissement/titres-signataire.js';
import { formaterDateLongue } from '../dates.js';
import { tonDecision } from '../decision.js';
import { deEtablissement } from '../grammaire.js';
import type { DonneesDocument, ImagesDocument } from '../donnees-document.js';
import { enregistrerPolices } from './polices.js';
import { dessinerQr } from './qr.js';

// --- Mise en page (A4, points PDF) ---
const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 58;
const LARGEUR_UTILE = LARGEUR - 2 * MARGE;
const HAUT_PIED = 648; // le corps du texte ne doit pas descendre sous cette ligne

const COULEURS_DECISION = {
  positive: '#15803D', // vert : passe en classe supérieure
  negative: '#B91C1C', // rouge : redoublement, échec
} as const;

const COULEURS = {
  encre: '#111827',
  marine: '#1E3A5F',
  gris: '#6B7280',
  filet: '#CBD5E1',
  fond: '#F3F5F8',
};

interface Fragment {
  texte: string;
  gras?: boolean;
  italique?: boolean;
}

/** Espaces insécables : une date ou « de droit » ne se coupe pas en fin de ligne. */
const insecable = (texte: string) => texte.replace(/ /g, '\u00A0');
const dateInsecable = (iso: string) => insecable(formaterDateLongue(iso));

const police = (f: Fragment) =>
  f.gras && f.italique
    ? 'Serif-BoldItalic'
    : f.gras
      ? 'Serif-Bold'
      : f.italique
        ? 'Serif-Italic'
        : 'Serif';

function nouveauDocument(titre: string, auteur: string) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title: titre,
      Author: auteur,
      Creator: 'Scoly',
      Producer: 'Scoly',
    },
  });
  enregistrerPolices(doc);
  return doc;
}

/** Texte en plusieurs fragments (gras / italique) qui s'enchaînent dans un même paragraphe. */
function ecrireFragments(
  doc: PDFKit.PDFDocument,
  fragments: Fragment[],
  x: number,
  y: number,
  options: {
    largeur: number;
    taille: number;
    interligne: number;
    align?: 'left' | 'justify' | 'center' | 'right';
    retrait?: number;
  },
): number {
  fragments.forEach((fragment, i) => {
    // Pas de clé `undefined` dans les options : PDFKit les traiterait comme
    // une nouvelle position et couperait la ligne à chaque fragment.
    const opts: PDFKit.Mixins.TextOptions = {
      width: options.largeur,
      align: options.align ?? 'left',
      lineGap: options.interligne,
      continued: i < fragments.length - 1,
    };
    if (i === 0 && options.retrait) opts.indent = options.retrait;

    doc.font(police(fragment)).fontSize(options.taille);
    if (i === 0) doc.text(fragment.texte, x, y, opts);
    else doc.text(fragment.texte, opts);
  });
  return doc.y;
}

// ---------------------------------------------------------------------------
// Cadre, filigrane, en-tête
// ---------------------------------------------------------------------------

function dessinerCadre(doc: PDFKit.PDFDocument) {
  doc
    .save()
    .lineWidth(1.1)
    .strokeColor(COULEURS.marine)
    .rect(24, 24, LARGEUR - 48, HAUTEUR - 48)
    .stroke()
    .lineWidth(0.4)
    .strokeColor(COULEURS.filet)
    .rect(28.5, 28.5, LARGEUR - 57, HAUTEUR - 57)
    .stroke()
    .restore();
}

function dessinerFiligrane(
  doc: PDFKit.PDFDocument,
  logo: Buffer | undefined,
  apercu: boolean,
) {
  if (logo) {
    try {
      doc.save().opacity(0.07);
      doc.image(logo, (LARGEUR - 300) / 2, 300, {
        fit: [300, 300],
        align: 'center',
        valign: 'center',
      });
      doc.restore();
    } catch {
      doc.restore(); // image illisible : on continue sans filigrane
    }
  }
  if (apercu) {
    doc
      .save()
      .opacity(0.09)
      .fillColor('#B91C1C')
      .font('Serif-Bold')
      .fontSize(120)
      .rotate(-38, { origin: [LARGEUR / 2, HAUTEUR / 2] })
      .text('APERÇU', 0, HAUTEUR / 2 - 70, { width: LARGEUR, align: 'center' })
      .restore();
  }
}

function filetCourt(doc: PDFKit.PDFDocument, centreX: number, y: number) {
  doc
    .save()
    .lineWidth(0.6)
    .strokeColor(COULEURS.marine)
    .moveTo(centreX - 16, y)
    .lineTo(centreX + 16, y)
    .stroke()
    .restore();
}

/** Bloc de lignes centrées dans une colonne ; renvoie l'ordonnée de fin. */
function dessinerEntete(doc: PDFKit.PDFDocument, d: DonneesDocument): number {
  const haut = 52;
  const gauche = { x: MARGE, l: 262 };
  const droite = { x: LARGEUR - MARGE - 178, l: 178 };

  // --- Colonne gauche : tutelle administrative ---
  let y = haut;
  const blocs: {
    texte: string;
    taille: number;
    couleur: string;
    gras: boolean;
  }[] = [];
  const e = d.etablissement;
  if (e.ministereTutelle)
    blocs.push({
      texte: e.ministereTutelle.toLocaleUpperCase('fr-FR'),
      taille: 8.2,
      couleur: COULEURS.encre,
      gras: true,
    });
  if (e.directionDepartementale)
    blocs.push({
      texte: e.directionDepartementale.toLocaleUpperCase('fr-FR'),
      taille: 8.2,
      couleur: COULEURS.encre,
      gras: true,
    });
  blocs.push({
    texte: e.nom.toLocaleUpperCase('fr-FR'),
    taille: 9.4,
    couleur: COULEURS.marine,
    gras: true,
  });

  blocs.forEach((bloc, i) => {
    doc
      .font(bloc.gras ? 'Serif-Bold' : 'Serif')
      .fontSize(bloc.taille)
      .fillColor(bloc.couleur);
    doc.text(bloc.texte, gauche.x, y, {
      width: gauche.l,
      align: 'center',
      lineGap: 1.5,
    });
    y = doc.y + 3;
    if (i < blocs.length - 1) {
      filetCourt(doc, gauche.x + gauche.l / 2, y + 1);
      y += 7;
    }
  });
  const contact = [e.adresse, e.telephone, e.email]
    .filter(Boolean)
    .join('  ·  ');
  if (contact) {
    doc.font('Serif').fontSize(7.2).fillColor(COULEURS.gris);
    doc.text(contact, gauche.x, y + 1, { width: gauche.l, align: 'center' });
    y = doc.y;
  }
  const basGauche = y;

  // --- Colonne droite : République ---
  let yd = haut;
  doc.font('Serif-Bold').fontSize(10.5).fillColor(COULEURS.encre);
  doc.text('RÉPUBLIQUE DU BÉNIN', droite.x, yd, {
    width: droite.l,
    align: 'center',
  });
  yd = doc.y + 2;
  if (e.devise) {
    doc.font('Serif-Italic').fontSize(8.2).fillColor(COULEURS.gris);
    doc.text(e.devise, droite.x, yd, { width: droite.l, align: 'center' });
    yd = doc.y + 3;
  }
  filetCourt(doc, droite.x + droite.l / 2, yd + 1);

  // Double filet sous l'en-tête
  const bas = Math.max(basGauche, yd) + 12;
  doc
    .save()
    .lineWidth(1.1)
    .strokeColor(COULEURS.marine)
    .moveTo(MARGE, bas)
    .lineTo(LARGEUR - MARGE, bas)
    .stroke()
    .lineWidth(0.35)
    .moveTo(MARGE, bas + 2.6)
    .lineTo(LARGEUR - MARGE, bas + 2.6)
    .stroke()
    .restore();
  return bas + 2.6;
}

function dessinerTitre(
  doc: PDFKit.PDFDocument,
  d: DonneesDocument,
  y: number,
): number {
  doc.font('Serif-Bold').fontSize(21).fillColor(COULEURS.marine);
  doc.text('CERTIFICAT DE SCOLARITÉ', MARGE, y, {
    width: LARGEUR_UTILE,
    align: 'center',
    characterSpacing: 1.6,
  });
  let fin = doc.y + 6;
  doc
    .save()
    .lineWidth(2)
    .strokeColor(COULEURS.marine)
    .moveTo(LARGEUR / 2 - 34, fin)
    .lineTo(LARGEUR / 2 + 34, fin)
    .stroke()
    .restore();
  fin += 12;
  doc.font('Serif-Italic').fontSize(10.5).fillColor(COULEURS.encre);
  doc.text(d.numero, MARGE, fin, { width: LARGEUR_UTILE, align: 'center' });
  return doc.y;
}

// ---------------------------------------------------------------------------
// Corps du certificat
// ---------------------------------------------------------------------------

export function construireNarratif(d: DonneesDocument): Fragment[] {
  const { eleve, etablissement: etab, champs } = d;
  const f = eleve.sexe === 'FEMININ';
  const nomComplet = `${eleve.nom.toLocaleUpperCase('fr-FR')} ${eleve.prenoms}`;
  const frags: Fragment[] = [];

  // Ouverture : « Je soussigné, NOM Prénoms, Directeur de l'École X, certifie… »
  // (« La Direction de X certifie… » si le signataire n'est pas renseigné).
  if (etab.nomSignataire) {
    const titre = infosTitre(etab.fonctionSignataire);
    frags.push(
      { texte: `Je ${titre.soussigne}, ` },
      { texte: etab.nomSignataire, gras: true },
      {
        texte: `, ${titre.libelle} ${deEtablissement(etab.nom)}, certifie que l’élève `,
      },
    );
  } else {
    frags.push({
      texte: `La Direction ${deEtablissement(etab.nom)} certifie que l’élève `,
    });
  }

  frags.push(
    { texte: nomComplet, gras: true },
    { texte: `, ${f ? 'née' : 'né'} le ` },
    { texte: dateInsecable(eleve.dateNaissance), gras: true },
    { texte: ' à ' },
    { texte: eleve.lieuNaissance, gras: true },
  );

  // Matricules : les deux s'ils existent, sinon celui qui existe, sinon rien.
  const immat = f ? 'immatriculée' : 'immatriculé';
  if (eleve.matricule && eleve.matriculeEducMaster) {
    frags.push(
      { texte: `, ${immat} sous le numéro ` },
      { texte: eleve.matricule, gras: true },
      { texte: ' (matricule EducMaster : ' },
      { texte: eleve.matriculeEducMaster, gras: true },
      { texte: '),' },
    );
  } else if (eleve.matricule) {
    frags.push(
      { texte: `, ${immat} sous le numéro ` },
      { texte: eleve.matricule, gras: true },
      { texte: ',' },
    );
  } else if (eleve.matriculeEducMaster) {
    frags.push(
      { texte: `, ${immat} sous le matricule EducMaster ` },
      { texte: eleve.matriculeEducMaster, gras: true },
      { texte: ',' },
    );
  }

  frags.push({
    texte: ` est régulièrement ${f ? 'inscrite' : 'inscrit'} dans notre établissement`,
  });
  if (champs.dateInscription) {
    frags.push(
      { texte: ' depuis le ' },
      { texte: dateInsecable(champs.dateInscription), gras: true },
    );
  }
  frags.push(
    { texte: ' et y poursuit actuellement ses études en classe de ' },
    { texte: champs.classe ?? '—', gras: true },
  );
  if (d.anneeScolaire) {
    frags.push(
      { texte: ', au titre de l’année scolaire ' },
      { texte: d.anneeScolaire, gras: true },
    );
  }
  frags.push({ texte: '.' });
  return frags;
}

function etiquetteSection(
  doc: PDFKit.PDFDocument,
  texte: string,
  y: number,
): number {
  doc.font('Serif-Bold').fontSize(8.6).fillColor(COULEURS.marine);
  doc.text(texte, MARGE, y, { width: LARGEUR_UTILE, characterSpacing: 1.2 });
  const fin = doc.y + 3;
  doc
    .save()
    .lineWidth(0.5)
    .strokeColor(COULEURS.filet)
    .moveTo(MARGE, fin)
    .lineTo(LARGEUR - MARGE, fin)
    .stroke()
    .restore();
  return fin + 9;
}

/**
 * Dessine le corps entre le titre et le pied de page ; renvoie l'ordonnée de
 * fin. `echelle` rétrécit les tailles pour les cas extrêmes (voir rendre()).
 */
function dessinerCorps(
  doc: PDFKit.PDFDocument,
  d: DonneesDocument,
  debut: number,
  echelle: number,
): number {
  const taille = 11.6 * echelle;
  let y = debut;

  y = ecrireFragments(
    doc.fillColor(COULEURS.encre),
    construireNarratif(d),
    MARGE,
    y,
    {
      largeur: LARGEUR_UTILE,
      taille,
      interligne: 4.6 * echelle,
      retrait: 28,
    },
  );
  y += 17 * echelle;

  // --- Appréciations : trois cartes ---
  y = etiquetteSection(doc, 'APPRÉCIATIONS', y);
  const cartes = [
    ['Assiduité', d.champs.assiduite],
    ['Conduite', d.champs.conduite],
    ['Travail', d.champs.travail],
  ] as const;
  const ecart = 12;
  const largeurCarte = (LARGEUR_UTILE - 2 * ecart) / 3;
  const hauteurCarte = 46 * echelle;
  cartes.forEach(([libelle, valeur], i) => {
    const x = MARGE + i * (largeurCarte + ecart);
    doc
      .save()
      .roundedRect(x, y, largeurCarte, hauteurCarte, 4)
      .fill(COULEURS.fond)
      .restore();
    doc
      .font('Serif')
      .fontSize(8 * echelle)
      .fillColor(COULEURS.gris);
    doc.text(libelle.toUpperCase(), x, y + 9 * echelle, {
      width: largeurCarte,
      align: 'center',
      characterSpacing: 0.9,
    });
    doc
      .font('Serif-Bold')
      .fontSize(12.5 * echelle)
      .fillColor(COULEURS.encre);
    doc.text(valeur ?? '—', x, y + 23 * echelle, {
      width: largeurCarte,
      align: 'center',
    });
  });
  y += hauteurCarte + 17 * echelle;

  // --- Observations / décision ---
  y = etiquetteSection(doc, 'OBSERVATIONS PARTICULIÈRES / DÉCISION', y);
  const observations = d.champs.observations || 'Néant.';
  const xTexte = MARGE + 12;
  // Vert / rouge selon la décision (détection par mots-clés, cf. decision.ts) ;
  // texte en gras italique et trait latéral de la même couleur.
  const ton = tonDecision(observations);
  const colore = ton !== 'neutre';
  const couleur = colore ? COULEURS_DECISION[ton] : COULEURS.encre;
  doc
    .font(colore ? 'Serif-BoldItalic' : 'Serif-Italic')
    .fontSize(11.5 * echelle)
    .fillColor(couleur);
  const haut = y;
  doc.text(observations, xTexte, y, {
    width: LARGEUR_UTILE - 12,
    lineGap: 4 * echelle,
  });
  const fin = doc.y;
  doc
    .save()
    .lineWidth(2)
    .strokeColor(colore ? couleur : COULEURS.marine)
    .moveTo(MARGE + 2, haut - 1)
    .lineTo(MARGE + 2, fin + 1)
    .stroke()
    .restore();
  y = fin + 15 * echelle;

  // --- Formule de clôture ---
  doc
    .font('Serif')
    .fontSize(11.5 * echelle)
    .fillColor(COULEURS.encre);
  doc.text(
    `En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que ${insecable('de droit')}.`,
    MARGE,
    y,
    { width: LARGEUR_UTILE, lineGap: 4 * echelle, indent: 28 },
  );
  return doc.y;
}

// ---------------------------------------------------------------------------
// Pied de page : QR, signature
// ---------------------------------------------------------------------------

function imageSure(
  doc: PDFKit.PDFDocument,
  image: Buffer | undefined,
  x: number,
  y: number,
  fit: [number, number],
) {
  if (!image) return;
  try {
    doc.image(image, x, y, { fit, align: 'center', valign: 'center' });
  } catch {
    /* image illisible : ignorée, le document reste valide */
  }
}

function dessinerPied(
  doc: PDFKit.PDFDocument,
  d: DonneesDocument,
  images: ImagesDocument,
) {
  const haut = HAUT_PIED + 14;

  // --- Gauche : QR code de vérification ---
  const tailleQr = 78;
  if (d.urlVerification) {
    dessinerQr(doc, d.urlVerification, MARGE, haut, tailleQr);
  } else {
    doc
      .save()
      .lineWidth(0.8)
      .dash(3, { space: 3 })
      .strokeColor(COULEURS.gris)
      .rect(MARGE, haut, tailleQr, tailleQr)
      .stroke()
      .undash()
      .restore();
    doc.font('Serif').fontSize(8).fillColor(COULEURS.gris);
    doc.text('QR code', MARGE, haut + tailleQr / 2 - 5, {
      width: tailleQr,
      align: 'center',
    });
  }
  // --- Droite : lieu, date, signataire ---
  const largeurSig = 214;
  const xSig = LARGEUR - MARGE - largeurSig;
  doc.font('Serif').fontSize(11).fillColor(COULEURS.encre);
  doc.text(
    `Fait à ${d.etablissement.lieu}, le ${formaterDateLongue(d.dateEmission)}`,
    xSig,
    haut,
    { width: largeurSig, align: 'center' },
  );
  let y = doc.y + 6;

  // Titre du signataire : « Le Directeur, » / « La Directrice, »…
  doc.font('Serif-Bold').fontSize(11);
  doc.text(
    `${infosTitre(d.etablissement.fonctionSignataire).avecArticle},`,
    xSig,
    y,
    {
      width: largeurSig,
      align: 'center',
    },
  );
  y = doc.y;

  // Espace de signature (+ cachet et signature numérisés s'ils existent)
  const hauteurSignature = 50;
  imageSure(doc, images.cachet, xSig + 8, y + 2, [72, 72]);
  imageSure(doc, images.signature, xSig + 60, y + 4, [110, 52]);
  y += hauteurSignature;

  if (d.etablissement.nomSignataire) {
    doc.font('Serif-Bold').fontSize(11.5).fillColor(COULEURS.encre);
    doc.text(d.etablissement.nomSignataire, xSig, y, {
      width: largeurSig,
      align: 'center',
      underline: true,
    });
  }

  // --- Bas de page ---
  const yBas = HAUTEUR - 56;
  doc
    .save()
    .lineWidth(0.4)
    .strokeColor(COULEURS.filet)
    .moveTo(MARGE, yBas)
    .lineTo(LARGEUR - MARGE, yBas)
    .stroke()
    .restore();
  doc.font('Serif').fontSize(6.8).fillColor(COULEURS.gris);
  doc.text(
    d.apercu
      ? "APERÇU — ce document n'a aucune valeur : il n'est ni numéroté ni enregistré."
      : `Document établi via Scoly  ·  Réf. ${d.numero}  ·  Toute altération de ce document le rend invalide.`,
    MARGE,
    yBas + 6,
    { width: LARGEUR_UTILE, align: 'center' },
  );
}

// ---------------------------------------------------------------------------

function collecter(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const morceaux: Buffer[] = [];
    doc.on('data', (m: Buffer) => morceaux.push(m));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);
  });
}

/** Plus grande échelle (1 → 0,8) pour laquelle le corps tient au-dessus du pied de page. */
function choisirEchelle(d: DonneesDocument, debut: number): number {
  for (const echelle of [1, 0.94, 0.88, 0.82]) {
    const essai = nouveauDocument('mesure', '');
    essai.on('data', () => undefined);
    const fin = dessinerCorps(essai, d, debut, echelle);
    essai.end();
    if (fin <= HAUT_PIED - 6) return echelle;
  }
  return 0.82;
}

export async function rendreCertificatScolarite(
  d: DonneesDocument,
  images: ImagesDocument,
): Promise<Buffer> {
  const doc = nouveauDocument(
    `Certificat de scolarité — ${d.eleve.nom} ${d.eleve.prenoms}`,
    d.etablissement.nom,
  );
  const fini = collecter(doc);

  dessinerCadre(doc);
  dessinerFiligrane(doc, images.logo, d.apercu);
  const basEntete = dessinerEntete(doc, d);
  const basTitre = dessinerTitre(doc, d, basEntete + 28);
  const debutCorps = basTitre + 26;
  dessinerCorps(doc, d, debutCorps, choisirEchelle(d, debutCorps));
  dessinerPied(doc, d, images);

  doc.end();
  return fini;
}
