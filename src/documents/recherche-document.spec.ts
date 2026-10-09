import { construireTexteRechercheDocument } from './recherche-document.js';
import { motsDeRecherche } from '../eleves/utils/recherche.js';

describe('construireTexteRechercheDocument', () => {
  const eleve = {
    nom: 'AKPOVI',
    prenoms: 'Adjovi Éloïse',
    matricule: 'CEG-0001',
    matriculeEducMaster: null,
  };

  it('regroupe référence et identité, sans accents ni majuscules', () => {
    expect(
      construireTexteRechercheDocument('N°24/2025-2026/CEG-GODOMEY', eleve),
    ).toBe('n 24 2025 2026 ceg godomey akpovi adjovi eloise ceg 0001');
  });

  it('retrouve le document en tapant la référence, un nom ou un numéro seul', () => {
    const texte = construireTexteRechercheDocument(
      'N°24/2025-2026/CEG-GODOMEY',
      eleve,
    );
    const trouve = (saisie: string) =>
      motsDeRecherche(saisie).every((mot) => texte.includes(mot));

    expect(trouve('N°24/2025-2026/CEG-GODOMEY')).toBe(true);
    expect(trouve('eloise adjovi')).toBe(true);
    expect(trouve('AKPOVI')).toBe(true);
    expect(trouve('ceg-0001')).toBe(true);
    expect(trouve('dossou')).toBe(false);
  });
});
