import { verifierDateInscription } from './est-date-inscription.validator.js';

const MAINTENANT = new Date('2026-10-02T12:00:00Z');
const verifier = (valeur: unknown, naissance?: string) =>
  verifierDateInscription(valeur, naissance, MAINTENANT);

describe('verifierDateInscription', () => {
  it('accepte une date passée valide', () => {
    expect(verifier('2023-06-22')).toBeNull();
    expect(verifier('2026-10-02')).toBeNull(); // aujourd'hui
  });

  it.each(['22/06/2023', '2023-02-30', '', null, 20230622])(
    'refuse le format invalide : %s',
    (valeur) => {
      expect(verifier(valeur)).toMatch(/invalide/);
    },
  );

  it('refuse une date future', () => {
    expect(verifier('2026-10-03')).toMatch(/futur/);
  });

  it('exige d’être postérieure à la naissance quand elle est connue', () => {
    expect(verifier('2014-07-15', '2014-07-15')).toMatch(/postérieure/);
    expect(verifier('2010-01-01', '2014-07-15')).toMatch(/postérieure/);
    expect(verifier('2020-09-01', '2014-07-15')).toBeNull();
  });
});
