import { analyserDateNaissance } from './est-date-naissance.validator.js';

const MAINTENANT = new Date('2026-09-30T12:00:00Z');
const analyser = (valeur: unknown) => analyserDateNaissance(valeur, MAINTENANT);

describe('analyserDateNaissance', () => {
  it('accepte une date valide', () => {
    const r = analyser('2014-07-15');
    expect(r.valide).toBe(true);
  });

  it.each([
    '15/07/2014',
    '2014-7-15',
    '2014-02-30',
    '2014-13-01',
    '',
    20140715,
    null,
  ])('refuse le format invalide : %s', (valeur) => {
    expect(analyser(valeur).valide).toBe(false);
  });

  it('refuse une date future', () => {
    const r = analyser('2026-10-01');
    expect(r).toMatchObject({ valide: false });
    expect((r as { message: string }).message).toMatch(/futur/);
  });

  it('applique les bornes d’âge (2 à 30 ans) au jour près', () => {
    expect(analyser('2024-09-30').valide).toBe(true); // 2 ans pile
    expect(analyser('2024-10-01').valide).toBe(false); // 1 an et 364 jours
    expect(analyser('1996-09-30').valide).toBe(true); // 30 ans pile
    expect(analyser('1996-09-29').valide).toBe(true); // 30 ans et 1 jour
    expect(analyser('1995-09-30').valide).toBe(false); // 31 ans
  });
});
