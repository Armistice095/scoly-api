import { masquerNomEleve } from './masquage.js';

describe('masquerNomEleve', () => {
  it('garde le premier prénom et l’initiale du nom', () => {
    expect(masquerNomEleve('Akpovi', 'Adjovi')).toBe('Adjovi A.');
  });
  it('n’expose que le premier prénom', () => {
    expect(masquerNomEleve('Dossou', 'Koffi Jean Marc')).toBe('Koffi D.');
  });
  it('met l’initiale en majuscule, accentuée ou non', () => {
    expect(masquerNomEleve('élégbédé', 'Koffi')).toBe('Koffi É.');
    expect(masquerNomEleve('da silva', 'Koffi')).toBe('Koffi D.');
  });
  it('tolère espaces superflus et champs vides', () => {
    expect(masquerNomEleve('  Akpovi ', '  Adjovi  Marie ')).toBe('Adjovi A.');
    expect(masquerNomEleve('', 'Adjovi')).toBe('Adjovi');
    expect(masquerNomEleve('Akpovi', '')).toBe('A.');
  });
  it('ne coupe pas un caractère hors plan de base', () => {
    expect(masquerNomEleve('𠮷田', 'Koffi')).toBe('Koffi 𠮷.');
  });
});
