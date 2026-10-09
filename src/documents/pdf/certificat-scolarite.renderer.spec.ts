import {
  construireNarratif,
  rendreCertificatScolarite,
} from './certificat-scolarite.renderer.js';
import type { DonneesDocument } from '../donnees-document.js';

const base: DonneesDocument = {
  etablissement: {
    nom: 'CEG Godomey',
    ministereTutelle: 'Ministère des Enseignements Maternel et Primaire',
    directionDepartementale: 'Direction Départementale du Mono',
    devise: 'Fraternité – Justice – Travail',
    adresse: 'Godomey',
    telephone: null,
    email: null,
    nomSignataire: 'Jean Dossou',
    fonctionSignataire: 'Le Directeur,',
    lieu: 'Abomey-Calavi',
  },
  anneeScolaire: '2025-2026',
  eleve: {
    nom: 'Adjaho',
    prenoms: 'Nadège',
    sexe: 'FEMININ',
    dateNaissance: '2014-07-15',
    lieuNaissance: 'Cotonou',
    matricule: 'CEG-0007',
    matriculeEducMaster: 'EM-7300322',
  },
  champs: {
    classe: 'CE1',
    dateInscription: '2023-06-22',
    assiduite: 'Bonne',
    conduite: 'Bonne',
    travail: 'Satisfaisant',
  },
  numero: 'N°12/2025-2026',
  dateEmission: '2026-10-02',
  urlVerification: 'https://scoly.app/verifier/abc',
  apercu: false,
};

const nbPages = (pdf: Buffer) =>
  (pdf.toString('latin1').match(/\/Type \/Page\n/g) ?? []).length;

describe('rendreCertificatScolarite', () => {
  it('produit un PDF valide d’une seule page', async () => {
    const pdf = await rendreCertificatScolarite(base, {});
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(nbPages(pdf)).toBe(1);
  });

  it('reste sur une page dans les cas extrêmes', async () => {
    const pdf = await rendreCertificatScolarite(
      {
        ...base,
        etablissement: {
          ...base.etablissement,
          nom: 'Complexe scolaire privé bilingue Notre-Dame des Apôtres de la Sainte-Famille de Porto-Novo '.repeat(
            2,
          ),
          fonctionSignataire: 'Proviseure',
        },
        eleve: {
          ...base.eleve,
          prenoms:
            'Sènami Ɛkoué Ɔlúfẹ́mi Jean-Baptiste Marie-Noëlle Œdipe Chimène',
          matricule: null,
          matriculeEducMaster: null,
        },
        champs: {
          ...base.champs,
          observations: 'Élève sérieux et appliqué. '.repeat(11).slice(0, 300),
        },
      },
      {},
    );
    expect(nbPages(pdf)).toBe(1);
  });

  it('gère les informations facultatives absentes', async () => {
    const pdf = await rendreCertificatScolarite(
      {
        ...base,
        etablissement: {
          ...base.etablissement,
          ministereTutelle: null,
          directionDepartementale: null,
          devise: null,
          nomSignataire: null,
          fonctionSignataire: null,
        },
        anneeScolaire: null,
        eleve: { ...base.eleve, matricule: null },
      },
      {},
    );
    expect(nbPages(pdf)).toBe(1);
  });

  it('produit un aperçu sans QR code de vérification', async () => {
    const pdf = await rendreCertificatScolarite(
      { ...base, apercu: true, urlVerification: null },
      {},
    );
    expect(nbPages(pdf)).toBe(1);
  });

  it('ignore une image illisible au lieu d’échouer', async () => {
    const pdf = await rendreCertificatScolarite(base, {
      logo: Buffer.from('pas une image'),
      signature: Buffer.from('non plus'),
    });
    expect(nbPages(pdf)).toBe(1);
  });
});

// Texte lisible du paragraphe d'ouverture (espaces insécables ramenés à des espaces).
const narratif = (d: DonneesDocument) =>
  construireNarratif(d)
    .map((f) => f.texte)
    .join('')
    .replace(/\u00A0/g, ' ');

describe('phrase d’ouverture du certificat', () => {
  const arche: DonneesDocument = {
    ...base,
    etablissement: {
      ...base.etablissement,
      nom: 'École primaire privée Arche du Millénium de Comé',
      nomSignataire: 'AMOUSSOU Coffi Darius',
      fonctionSignataire: 'Directeur',
    },
    eleve: {
      ...base.eleve,
      nom: 'Damessi',
      prenoms: 'Kouèdji Pascaline Hortense',
      lieuNaissance: 'Abomey',
      dateNaissance: '2014-04-20',
      matricule: 'CEG-0007',
      matriculeEducMaster: 'EM-1180924013060',
    },
  };

  it('reproduit exactement le texte validé', () => {
    expect(narratif(arche)).toBe(
      'Je soussigné, AMOUSSOU Coffi Darius, Directeur de l’École primaire privée Arche du Millénium de Comé, ' +
        'certifie que l’élève DAMESSI Kouèdji Pascaline Hortense, née le 20 avril 2014 à Abomey, ' +
        'immatriculée sous le numéro CEG-0007 (matricule EducMaster : EM-1180924013060), ' +
        'est régulièrement inscrite dans notre établissement depuis le 22 juin 2023 ' +
        'et y poursuit actuellement ses études en classe de CE1, au titre de l’année scolaire 2025-2026.',
    );
  });

  it('s’accorde avec le titre féminin du signataire et l’élève masculin', () => {
    const texte = narratif({
      ...arche,
      etablissement: {
        ...arche.etablissement,
        nom: 'CEG Godomey',
        nomSignataire: 'HOUNKPATIN Marie-Claire',
        fonctionSignataire: 'Proviseure',
      },
      eleve: { ...arche.eleve, sexe: 'MASCULIN' },
    });
    expect(texte).toContain(
      'Je soussignée, HOUNKPATIN Marie-Claire, Proviseure du CEG Godomey, certifie',
    );
    expect(texte).toContain('né le 20 avril 2014');
    expect(texte).toContain('immatriculé sous');
    expect(texte).toContain('est régulièrement inscrit dans');
  });

  it('retombe sur « La Direction » sans nom de signataire', () => {
    const texte = narratif({
      ...arche,
      etablissement: { ...arche.etablissement, nomSignataire: null },
    });
    expect(texte.startsWith('La Direction de l’École primaire privée')).toBe(
      true,
    );
    expect(texte).not.toContain('Je soussigné');
  });

  it('n’imprime que le matricule connu, ou aucun', () => {
    const seulement = (matricule: string | null, em: string | null) =>
      narratif({
        ...arche,
        eleve: { ...arche.eleve, matricule, matriculeEducMaster: em },
      });
    expect(seulement('CEG-0007', null)).toContain(
      'immatriculée sous le numéro CEG-0007, est',
    );
    expect(seulement(null, 'EM-1')).toContain(
      'immatriculée sous le matricule EducMaster EM-1, est',
    );
    expect(seulement(null, null)).not.toContain('immatricul');
  });

  it('omet la date d’inscription et l’année scolaire quand elles manquent', () => {
    const texte = narratif({
      ...arche,
      anneeScolaire: null,
      champs: { ...arche.champs, dateInscription: '' },
    });
    expect(texte).toContain('dans notre établissement et y poursuit');
    expect(texte.endsWith('en classe de CE1.')).toBe(true);
  });
});

describe('rendu de la décision et du QR code', () => {
  const texteDuPdf = (pdf: Buffer) => pdf.toString('latin1');

  it('colore la décision en vert, en rouge, ou la laisse neutre', async () => {
    const rendre = (observations: string) =>
      rendreCertificatScolarite(
        { ...base, champs: { ...base.champs, observations } },
        {},
      );
    const [vert, rouge, neutre] = await Promise.all([
      rendre('Passe en classe supérieure'),
      rendre('Redouble la classe'),
      rendre('Élève sérieux'),
    ]);
    // Les couleurs sont écrites dans le flux de dessin sous forme de réels RGB.
    // Flux compressés : on compare donc les PDF entre eux.
    expect(vert.equals(rouge)).toBe(false);
    expect(vert.equals(neutre)).toBe(false);
    expect(rouge.equals(neutre)).toBe(false);
    expect(texteDuPdf(vert)).toContain('%PDF-');
  });

  it('n’imprime plus de texte sous le QR code', async () => {
    // Le texte est dans un flux compressé : on vérifie la source plutôt que le PDF.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('./certificat-scolarite.renderer.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('Vérification en ligne');
    expect(source).not.toContain('Scannez le code');
  });
});
