import { dateCivileDuJour, formaterDateLongue } from './dates.js';

describe('dateCivileDuJour', () => {
  it('donne la date de Porto-Novo (UTC+1), pas celle du serveur UTC', () => {
    // 23h30 UTC le 1er octobre = 00h30 le 2 octobre à Porto-Novo.
    expect(dateCivileDuJour(new Date('2026-10-01T23:30:00Z'))).toBe(
      '2026-10-02',
    );
    expect(dateCivileDuJour(new Date('2026-10-01T22:59:00Z'))).toBe(
      '2026-10-01',
    );
  });
});

describe('formaterDateLongue', () => {
  it.each([
    ['2026-10-02', '2 octobre 2026'],
    ['2014-04-20', '20 avril 2014'],
    ['2023-06-01', '1er juin 2023'],
    ['2024-12-31', '31 décembre 2024'],
    ['2024-02-09', '9 février 2024'],
  ])('%s → %s', (iso, attendu) => {
    expect(formaterDateLongue(iso)).toBe(attendu);
  });
});
