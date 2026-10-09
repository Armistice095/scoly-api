import { normaliserReference } from './reference-normalisee.js';
import { FORMAT_TOKEN_QR, genererTokenQr } from './qr-token.js';

const CANONIQUE = '42 2025 2026 ceg godomey';

describe('normaliserReference', () => {
  it('produit la clé canonique pour la référence imprimée', () => {
    expect(normaliserReference('N°0042/2025-2026/CEG-GODOMEY')).toBe(CANONIQUE);
  });

  it.each([
    ['n°42/2025-2026/ceg-godomey', 'casse'],
    ['  N° 42 / 2025-2026 / CEG GODOMEY  ', 'espaces et séparateurs'],
    ['N 42/2025-2026/CEG-GODOMEY', 'N sans degré'],
    ['No 42/2025-2026/CEG-GODOMEY', 'No'],
    ['Nº42/2025-2026/CEG-GODOMEY', 'ordinal masculin'],
    ['N˚42/2025-2026/CEG-GODOMEY', 'rond en chef'],
    ['№42/2025-2026/CEG-GODOMEY', 'signe numéro'],
    ['N.42/2025-2026/CEG-GODOMEY', 'N.'],
    ['Numéro 42/2025-2026/CEG-GODOMEY', 'Numéro'],
    ['N42/2025-2026/CEG-GODOMEY', 'N collé'],
    ['42/2025-2026/CEG-GODOMEY', 'sans préfixe'],
    ['N°00042/2025-2026/CEG-GODOMEY', 'zéros initiaux'],
    [
      'N°42//2025_2026\\CEG–GODOMEY',
      'séparateurs variés (tiret demi-cadratin)',
    ],
    ['N°４２/2025-2026/CEG-GODOMEY', 'chiffres pleine largeur'],
  ])('tolère %s (%s)', (saisie) => {
    expect(normaliserReference(saisie)).toBe(CANONIQUE);
  });

  it('ignore les accents', () => {
    expect(normaliserReference('N°7/2025-2026/CEG-GODOMÉY')).toBe(
      normaliserReference('n°07/2025-2026/ceg godomey'),
    );
  });

  it('ne confond pas deux numéros différents', () => {
    expect(normaliserReference('N°42/2025-2026/CEG')).not.toBe(
      normaliserReference('N°24/2025-2026/CEG'),
    );
    expect(normaliserReference('N°4/2025-2026/CEG')).not.toBe(
      normaliserReference('N°40/2025-2026/CEG'),
    );
  });

  it('ne confond pas deux années scolaires', () => {
    expect(normaliserReference('N°42/2025-2026/CEG')).not.toBe(
      normaliserReference('N°42/2024-2025/CEG'),
    );
  });

  it('garde un zéro seul et ne retire pas un « n » qui fait partie d’un mot', () => {
    expect(normaliserReference('N°0/2025')).toBe('0 2025');
    expect(normaliserReference('NORD-12/2025')).toBe('nord 12 2025');
    expect(normaliserReference('SCO-2026-000123')).toBe('sco 2026 123');
  });

  it('ne retire pas le préfixe s’il est seul', () => {
    expect(normaliserReference('N°')).toBe('n');
    expect(normaliserReference('No')).toBe('no');
  });

  it('renvoie une chaîne vide sans lettre ni chiffre', () => {
    expect(normaliserReference('')).toBe('');
    expect(normaliserReference(' °/-_ ')).toBe('');
  });

  it('est idempotente', () => {
    const une = normaliserReference('N°0042/2025-2026/CEG-GODOMEY');
    expect(normaliserReference(une)).toBe(une);
  });
});

describe('genererTokenQr', () => {
  it('respecte FORMAT_TOKEN_QR et ne se répète pas', () => {
    const a = genererTokenQr();
    expect(a).toMatch(FORMAT_TOKEN_QR);
    expect(a).toHaveLength(32);
    expect(genererTokenQr()).not.toBe(a);
  });

  it('rejette ce qui ne peut pas être un jeton', () => {
    expect(FORMAT_TOKEN_QR.test('court')).toBe(false);
    expect(FORMAT_TOKEN_QR.test('a'.repeat(33))).toBe(false);
    expect(FORMAT_TOKEN_QR.test(`${'a'.repeat(31)}/`)).toBe(false);
    expect(FORMAT_TOKEN_QR.test(`${'a'.repeat(31)}\n`)).toBe(false);
  });
});
