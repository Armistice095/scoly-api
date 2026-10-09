import {
  correspondEtablissement,
  reponseAvecDocument,
  reponseSansDocument,
} from './verification-document.mapper.js';
import {
  documentAnnule,
  documentBrut,
  SECRETS,
} from '../../test/fixtures/verification-document.js';

const MAINTENANT = new Date('2026-10-05T17:47:12.345Z');

describe('reponseAvecDocument', () => {
  it('document actif : VALIDE avec le strict nécessaire', () => {
    expect(reponseAvecDocument(documentBrut(), MAINTENANT)).toEqual({
      resultat: 'VALIDE',
      verifieLe: '2026-10-05T17:47:12.345Z',
      document: {
        typeDocument: 'Certificat de scolarité',
        reference: 'N°0042/2025-2026/CEG-GODOMEY',
        eleve: 'Adjovi A.',
        dateEmission: '2026-09-28',
        dateAnnulation: null,
      },
      etablissement: {
        nom: 'CEG Godomey', // nom imprimé, pas le nom actuel
        localite: 'Abomey-Calavi, Atlantique',
        pays: 'République du Bénin',
        telephone: '+229 01 00 00 00 00', // coordonnées ACTUELLES, pas celles du snapshot
        email: 'secretariat@ceg-godomey.bj',
      },
    });
  });

  it('document annulé : ANNULE avec la date civile locale (Africa/Porto-Novo)', () => {
    const r = reponseAvecDocument(documentAnnule(), MAINTENANT);
    expect(r.resultat).toBe('ANNULE');
    expect(r.document?.dateAnnulation).toBe('2026-10-01');
  });

  it('CONFIDENTIALITÉ : aucune donnée sensible dans la réponse sérialisée', () => {
    for (const doc of [documentBrut(), documentAnnule()]) {
      const json = JSON.stringify(reponseAvecDocument(doc, MAINTENANT));
      for (const secret of SECRETS) {
        // « Akpovi » : seule l'initiale « A. » est publique ; « Adjovi » (1er prénom) l'est aussi.
        expect(json, `fuite de « ${secret} »`).not.toContain(secret);
      }
    }
  });

  it('CONFIDENTIALITÉ : seules les clés prévues existent (liste blanche)', () => {
    const r = reponseAvecDocument(documentAnnule(), MAINTENANT);
    expect(Object.keys(r).sort()).toEqual([
      'document',
      'etablissement',
      'resultat',
      'verifieLe',
    ]);
    expect(Object.keys(r.document!).sort()).toEqual([
      'dateAnnulation',
      'dateEmission',
      'eleve',
      'reference',
      'typeDocument',
    ]);
    expect(Object.keys(r.etablissement!).sort()).toEqual([
      'email',
      'localite',
      'nom',
      'pays',
      'telephone',
    ]);
  });

  it('contacts absents → null ; localité sans trou', () => {
    const doc = documentBrut();
    doc.etablissement = {
      ...doc.etablissement,
      telephone: null,
      email: ' ',
      commune: ' ',
    };
    const r = reponseAvecDocument(doc, MAINTENANT);
    expect(r.etablissement).toMatchObject({
      telephone: null,
      email: null,
      localite: 'Atlantique',
    });
  });
});

describe('reponseSansDocument', () => {
  it('INTROUVABLE et AMBIGU ont exactement la même forme, vide', () => {
    const a = reponseSansDocument('INTROUVABLE', MAINTENANT);
    const b = reponseSansDocument('AMBIGU', MAINTENANT);
    expect(Object.keys(a)).toEqual(Object.keys(b));
    expect(a).toEqual({
      resultat: 'INTROUVABLE',
      verifieLe: '2026-10-05T17:47:12.345Z',
      document: null,
      etablissement: null,
    });
  });
});

describe('correspondEtablissement', () => {
  it('compare au nom imprimé OU actuel, mots partiels, sans accent', () => {
    const doc = documentBrut();
    expect(correspondEtablissement(doc, ['ceg', 'godomey'])).toBe(true);
    expect(correspondEtablissement(doc, ['godom'])).toBe(true);
    expect(correspondEtablissement(doc, ['renomme'])).toBe(true);
    expect(correspondEtablissement(doc, ['lycee'])).toBe(false);
    expect(correspondEtablissement(doc, ['ceg', 'lycee'])).toBe(false);
  });
});
