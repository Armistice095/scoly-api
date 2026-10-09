import { ConflictException } from '@nestjs/common';
import {
  FORMAT_REFERENCE_PAR_DEFAUT,
  formaterNumeroReference,
  formatRepartACadaAnnee,
} from './numerotation.js';

describe('formaterNumeroReference', () => {
  it('remplace {N} et {ANNEE}, et imprime le format tel quel', () => {
    expect(
      formaterNumeroReference('N°{N}/{ANNEE}/CEG-GODOMEY', 12, '2025-2026'),
    ).toBe('N°12/2025-2026/CEG-GODOMEY');
  });

  it('remplace toutes les occurrences', () => {
    expect(formaterNumeroReference('{N}-{N}', 3, null)).toBe('3-3');
  });

  it('utilise le format par défaut quand rien n’est défini', () => {
    expect(formaterNumeroReference(null, 1, '2026-2027')).toBe('N°1/2026-2027');
    expect(formaterNumeroReference('   ', 1, '2026-2027')).toBe(
      'N°1/2026-2027',
    );
    expect(FORMAT_REFERENCE_PAR_DEFAUT).toContain('{N}');
  });

  it('affiche « … » à la place du numéro pour un aperçu', () => {
    expect(formaterNumeroReference('N°{N}/{ANNEE}', null, '2025-2026')).toBe(
      'N°…/2025-2026',
    );
  });

  it('refuse {ANNEE} sans année scolaire active, avec un code exploitable', () => {
    expect(() => formaterNumeroReference('N°{N}/{ANNEE}', 1, null)).toThrow(
      ConflictException,
    );
    try {
      formaterNumeroReference(null, 1, null);
    } catch (e) {
      expect((e as ConflictException).getResponse()).toMatchObject({
        code: 'ANNEE_SCOLAIRE_MANQUANTE',
      });
    }
  });

  it('n’exige pas d’année si le format n’en utilise pas', () => {
    expect(formaterNumeroReference('CERT-{N}', 7, null)).toBe('CERT-7');
  });
});

describe('formatRepartACadaAnnee', () => {
  it('ne remet à zéro que si le format porte l’année', () => {
    expect(formatRepartACadaAnnee('N°{N}/{ANNEE}')).toBe(true);
    expect(formatRepartACadaAnnee(null)).toBe(true); // défaut = contient {ANNEE}
    expect(formatRepartACadaAnnee('CERT-{N}')).toBe(false);
  });
});
