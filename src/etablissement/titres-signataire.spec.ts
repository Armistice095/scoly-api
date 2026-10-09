import { infosTitre } from './titres-signataire.js';

describe('infosTitre', () => {
  it.each([
    ['Directeur', 'Le Directeur', 'soussigné'],
    ['Directrice', 'La Directrice', 'soussignée'],
    ['Proviseur', 'Le Proviseur', 'soussigné'],
    ['Proviseure', 'La Proviseure', 'soussignée'],
  ])('%s', (titre, signature, soussigne) => {
    expect(infosTitre(titre)).toEqual({
      libelle: titre,
      avecArticle: signature,
      soussigne,
    });
  });

  it('prend « Directeur » quand aucun titre n’est enregistré', () => {
    expect(infosTitre(null).avecArticle).toBe('Le Directeur');
    expect(infosTitre('  ').soussigne).toBe('soussigné');
  });

  it('reprend tel quel un ancien titre libre, sans deviner le genre', () => {
    expect(infosTitre('Chef d’établissement')).toEqual({
      libelle: 'Chef d’établissement',
      avecArticle: 'Chef d’établissement',
      soussigne: 'soussigné(e)',
    });
  });
});
