import { tonDecision } from './decision.js';

describe('tonDecision', () => {
  it.each([
    'Passe en classe supérieure',
    'Passe au CE2',
    'passe en 6ème',
    'PASSE EN CLASSE SUPÉRIEURE',
    'Passage en classe supérieure',
    'Admise en classe supérieure',
    'Admis en 5ème',
    'Promu en CM1',
    'Félicitations, passe en CM2',
    'Passe en classe supérieure sans redoublement',
    'Pas de redoublement, passe au CE2',
  ])('vert : « %s »', (texte) => {
    expect(tonDecision(texte)).toBe('positive');
  });

  it.each([
    'Redouble la classe',
    'redouble le CE1',
    'Redoublement',
    'Doit redoubler',
    'Échec',
    'Echec scolaire',
    'Ajourné',
    'Non admis en classe supérieure',
    'Non admise',
    'Pas admis',
    "N'est pas admise en classe supérieure",
    'Ne passe pas en classe supérieure',
    'Exclu de l’établissement',
    'Renvoyé',
  ])('rouge : « %s »', (texte) => {
    expect(tonDecision(texte)).toBe('negative');
  });

  it('le négatif l’emporte sur le positif', () => {
    expect(
      tonDecision('Passe en classe supérieure mais redouble le français'),
    ).toBe('negative');
  });

  it.each([
    'Néant.',
    'Élève sérieux et appliqué',
    'À surveiller',
    'Bravo',
    'Compassion',
    'Passagère difficulté',
    '',
    '   ',
  ])('neutre : « %s »', (texte) => {
    expect(tonDecision(texte)).toBe('neutre');
  });

  it('neutre sans texte', () => {
    expect(tonDecision(undefined)).toBe('neutre');
    expect(tonDecision(null)).toBe('neutre');
  });
});
