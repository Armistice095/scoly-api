import {
  construireTexteRecherche,
  motsDeRecherche,
  normaliserPourRecherche,
} from './recherche.js';

describe('normaliserPourRecherche', () => {
  it.each([
    ['Nadège', 'nadege'],
    ['NADÈGE', 'nadege'],
    ['Sènami', 'senami'],
    ['Jean-Pierre', 'jean pierre'],
    ["N'Dah", 'n dah'],
    ['Œuvre', 'oeuvre'],
    ['  CEG-0007 ', 'ceg 0007'],
  ])('« %s » → « %s »', (entree, attendu) => {
    expect(normaliserPourRecherche(entree)).toBe(attendu);
  });
});

describe('motsDeRecherche', () => {
  it('découpe, normalise et ignore les séparateurs', () => {
    expect(motsDeRecherche(' ADJAHO   Nadège ')).toEqual(['adjaho', 'nadege']);
    expect(motsDeRecherche('CEG-0007')).toEqual(['ceg', '0007']);
    expect(motsDeRecherche('   ')).toEqual([]);
    expect(motsDeRecherche('---')).toEqual([]);
  });
});

describe('construireTexteRecherche', () => {
  it('concatène nom, prénoms et matricules renseignés', () => {
    expect(
      construireTexteRecherche({
        nom: 'ADJAHO',
        prenoms: 'Nadège',
        matricule: 'CEG-0007',
        matriculeEducMaster: null,
      }),
    ).toBe('adjaho nadege ceg 0007');
  });

  it('permet de retrouver un élève avec une saisie sans accent', () => {
    const texte = construireTexteRecherche({ nom: 'BIO', prenoms: 'Sènami' });
    expect(motsDeRecherche('senami').every((m) => texte.includes(m))).toBe(
      true,
    );
  });
});
