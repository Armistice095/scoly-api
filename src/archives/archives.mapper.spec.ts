import {
  construireHistorique,
  versDetail,
  versLigne,
  type DocumentPourDetail,
  type DocumentPourListe,
} from './archives.mapper.js';

const membre = {
  id: 'u-membre',
  nomComplet: 'Mireille Ahouandjinou',
  fonction: 'Secrétaire',
  email: 'mireille@ecole.bj',
};
const directeur = {
  id: 'u-dir',
  nomComplet: 'Eugène Sèdjro',
  fonction: 'Directeur',
  email: 'eugene@ecole.bj',
};

const donneesFigees = {
  eleve: {
    nom: 'Akpovi',
    prenoms: 'Adjovi',
    matricule: 'CEG-0001',
    matriculeEducMaster: 'EM-7300100',
  },
};

const base = {
  id: 'doc-1',
  numeroUnique: 'N°24/2025-2026/CEG-GODOMEY',
  statut: 'ACTIF',
  createdAt: new Date('2026-10-03T13:31:00Z'),
  dateEmission: new Date('2026-10-03T00:00:00Z'),
  eleveId: 'eleve-1',
  donneesFigees,
  typeDocument: {
    id: 't1',
    code: 'CERTIFICAT_SCOLARITE',
    nom: 'Certificat de scolarité',
  },
  annulation: null,
};

const liste = (surcharge: object = {}) =>
  ({ ...base, ...surcharge }) as unknown as DocumentPourListe;
const detail = (surcharge: object = {}) =>
  ({
    ...base,
    etabliPar: membre,
    telechargements: [],
    _count: { telechargements: 0 },
    ...surcharge,
  }) as unknown as DocumentPourDetail;

describe('versLigne', () => {
  it('donne l’élève tel qu’imprimé, « Prénoms Nom », et le document téléchargeable', () => {
    const ligne = versLigne(liste());
    expect(ligne).toMatchObject({
      id: 'doc-1',
      reference: 'N°24/2025-2026/CEG-GODOMEY',
      statut: 'ACTIF',
      dateEmission: '2026-10-03',
      eleve: { id: 'eleve-1', nomComplet: 'Adjovi Akpovi' },
      annulation: null,
      telechargeable: true,
    });
  });

  it('n’expose ni les données figées complètes ni les champs saisis', () => {
    const ligne = versLigne(
      liste({ champsSaisis: { observations: 'secret' } }),
    );
    expect(JSON.stringify(ligne)).not.toContain('secret');
    expect(ligne).not.toHaveProperty('donneesFigees');
  });

  it('un document annulé remonte son motif et n’est plus téléchargeable', () => {
    const ligne = versLigne(
      liste({
        statut: 'ANNULE',
        annulation: {
          motif: 'Erreur sur le nom de l’élève',
          createdAt: new Date('2026-10-02T09:57:00Z'),
        },
      }),
    );
    expect(ligne.telechargeable).toBe(false);
    expect(ligne.annulation).toEqual({
      motif: 'Erreur sur le nom de l’élève',
      le: new Date('2026-10-02T09:57:00Z'),
    });
  });
});

describe('versDetail', () => {
  it('renvoie la fiche d’un document actif', () => {
    const fiche = versDetail(detail());
    expect(fiche).toMatchObject({
      reference: 'N°24/2025-2026/CEG-GODOMEY',
      eleve: {
        id: 'eleve-1',
        nomComplet: 'Adjovi Akpovi',
        matricule: 'CEG-0001',
        matriculeEducMaster: 'EM-7300100',
      },
      etabli: {
        par: { nomComplet: 'Mireille Ahouandjinou', fonction: 'Secrétaire' },
        le: base.createdAt,
      },
      annulation: null,
      telechargeable: true,
      nombreTelechargements: 0,
    });
  });

  it('n’expose jamais l’e-mail des utilisateurs quand ils ont un nom', () => {
    expect(JSON.stringify(versDetail(detail()))).not.toContain('@ecole.bj');
  });

  it('retombe sur l’e-mail si l’utilisateur n’a pas de nom', () => {
    const fiche = versDetail(
      detail({ etabliPar: { ...membre, nomComplet: null } }),
    );
    expect(fiche.etabli.par.nomComplet).toBe('mireille@ecole.bj');
  });

  it('un document annulé : bloc annulation (qui, quand, pourquoi) et plus de téléchargement', () => {
    const fiche = versDetail(
      detail({
        statut: 'ANNULE',
        annulation: {
          motif: 'Erreur sur le nom de l’élève',
          createdAt: new Date('2026-10-04T08:00:00Z'),
          annulePar: directeur,
        },
      }),
    );
    expect(fiche.annulation).toEqual({
      par: { id: 'u-dir', nomComplet: 'Eugène Sèdjro', fonction: 'Directeur' },
      le: new Date('2026-10-04T08:00:00Z'),
      motif: 'Erreur sur le nom de l’élève',
    });
    expect(fiche.telechargeable).toBe(false);
  });

  it('le nom affiché est celui du document figé, pas celui d’une fiche élève corrigée depuis', () => {
    const fiche = versDetail(detail());
    expect(fiche.eleve.nomComplet).toBe('Adjovi Akpovi');
  });
});

describe('construireHistorique', () => {
  it('compose établi + téléchargements + annulation, du plus récent au plus ancien', () => {
    const historique = construireHistorique(
      detail({
        statut: 'ANNULE',
        telechargements: [
          {
            id: 'x2',
            createdAt: new Date('2026-10-04T07:00:00Z'),
            utilisateur: directeur,
          },
          {
            id: 'x1',
            createdAt: new Date('2026-10-03T13:59:00Z'),
            utilisateur: membre,
          },
        ],
        annulation: {
          motif: 'Erreur',
          createdAt: new Date('2026-10-04T08:00:00Z'),
          annulePar: directeur,
        },
      }),
    );

    expect(historique.map((e) => e.type)).toEqual([
      'ANNULE',
      'TELECHARGE',
      'TELECHARGE',
      'ETABLI',
    ]);
    expect(historique[0]!.par.nomComplet).toBe('Eugène Sèdjro');
    expect(historique[3]!.par.nomComplet).toBe('Mireille Ahouandjinou');
  });

  it('à égalité d’instant, « établi » reste le plus ancien', () => {
    const t = new Date('2026-10-03T13:31:00Z');
    const historique = construireHistorique(
      detail({
        telechargements: [{ id: 'x', createdAt: t, utilisateur: membre }],
      }),
    );
    expect(historique.map((e) => e.type)).toEqual(['TELECHARGE', 'ETABLI']);
  });
});
