import { BadRequestException } from '@nestjs/common';
import { lireRequete } from './lire-requete.js';
import { TOKEN } from '../../test/fixtures/verification-document.js';

const echec = (corps: object) => {
  try {
    lireRequete(corps);
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return (e as BadRequestException).getResponse() as {
      code: string;
      erreurs: { champ: string; message: string }[];
    };
  }
  throw new Error('aurait dû lever une 400');
};

describe('lireRequete', () => {
  it('canal QR : renvoie le jeton tel quel', () => {
    expect(lireRequete({ token: TOKEN })).toEqual({
      canal: 'QR',
      token: TOKEN,
    });
  });

  it('un jeton mal formé n’est PAS rejeté ici (traité comme introuvable plus loin)', () => {
    expect(lireRequete({ token: 'nimporte quoi' })).toEqual({
      canal: 'QR',
      token: 'nimporte quoi',
    });
  });

  it('canal SAISIE : normalise la référence', () => {
    expect(
      lireRequete({ reference: ' n° 42 / 2025-2026 / ceg godomey ' }),
    ).toEqual({
      canal: 'SAISIE',
      reference: '42 2025 2026 ceg godomey',
      etablissement: null,
    });
  });

  it('transforme le nom d’établissement en mots normalisés', () => {
    expect(
      lireRequete({ reference: 'N°42/2025', etablissement: 'CEG  Godomé' }),
    ).toMatchObject({ etablissement: ['ceg', 'godome'] });
  });

  it.each([undefined, null, ''])(
    'étab. %j = non renseigné',
    (etablissement) => {
      expect(
        lireRequete({
          reference: 'N°42/2025',
          etablissement: etablissement as never,
        }),
      ).toMatchObject({ etablissement: null });
    },
  );

  it.each([
    {},
    { reference: '' },
    { reference: null },
    { reference: '', token: '' },
  ])('CHAMP_VIDE pour %j', (corps) => {
    const r = echec(corps as object);
    expect(r.code).toBe('CHAMP_VIDE');
    expect(r.erreurs[0]!.champ).toBe('reference');
  });

  it('CHAMP_VIDE sur « token » quand c’est lui qui est vide', () => {
    expect(echec({ token: '' }).erreurs[0]!.champ).toBe('token');
  });

  it.each([
    ['uniquement de la ponctuation', { reference: '°°//--' }],
    ['sans aucun chiffre', { reference: 'CEG GODOMEY' }],
    ['trop longue', { reference: `N°1/${'A'.repeat(200)}` }],
    ['caractère de contrôle', { reference: 'N°42\u0000/2025' }],
    ['saut de ligne', { reference: 'N°42\n/2025' }],
  ])('FORMAT_INVALIDE : %s', (_cas, corps) => {
    const r = echec(corps);
    expect(r.code).toBe('FORMAT_INVALIDE');
    expect(r.erreurs[0]!.champ).toBe('reference');
  });

  it('FORMAT_INVALIDE si token ET référence', () => {
    expect(echec({ token: TOKEN, reference: 'N°42/2025' }).code).toBe(
      'FORMAT_INVALIDE',
    );
  });

  it('FORMAT_INVALIDE sur un établissement inexploitable', () => {
    const r = echec({ reference: 'N°42/2025', etablissement: '---' });
    expect(r.code).toBe('FORMAT_INVALIDE');
    expect(r.erreurs[0]!.champ).toBe('etablissement');
    expect(
      echec({ reference: 'N°42/2025', etablissement: 'x'.repeat(200) }).code,
    ).toBe('FORMAT_INVALIDE');
  });

  it('ignore l’établissement pour un jeton QR', () => {
    expect(lireRequete({ token: TOKEN, etablissement: 'CEG' })).toEqual({
      canal: 'QR',
      token: TOKEN,
    });
  });
});
