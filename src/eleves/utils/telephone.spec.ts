import { normaliserTelephone, REGEX_TELEPHONE } from './telephone.js';

describe('normaliserTelephone', () => {
  it.each([
    ['01 97 16 46 76', '+2290197164676'],
    ['0197164676', '+2290197164676'],
    ['+229 01 97 16 46 76', '+2290197164676'],
    ['00229 0197164676', '+2290197164676'],
    ['2290197164676', '+2290197164676'],
    ['+33 6 12 34 56 78', '+33612345678'],
  ])('« %s » → %s', (saisie, attendu) => {
    const resultat = normaliserTelephone(saisie);
    expect(resultat).toBe(attendu);
    expect(REGEX_TELEPHONE.test(resultat)).toBe(true);
  });

  it.each(['97164676', '197164676', 'abc', '12'])(
    'laisse « %s » invalide plutôt que de deviner un indicatif',
    (saisie) => {
      expect(REGEX_TELEPHONE.test(normaliserTelephone(saisie))).toBe(false);
    },
  );
});
