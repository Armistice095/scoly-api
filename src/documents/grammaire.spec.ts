import { deEtablissement } from './grammaire.js';

describe('deEtablissement', () => {
  it.each([
    [
      'École primaire privée Arche du Millénium de Comé',
      'de l’École primaire privée Arche du Millénium de Comé',
    ],
    ['Ecole Saint-Joseph', 'de l’Ecole Saint-Joseph'],
    ['EPP Godomey', 'de l’EPP Godomey'],
    ['Institut Sainte-Famille', 'de l’Institut Sainte-Famille'],
    ['Collège Notre-Dame', 'du Collège Notre-Dame'],
    ['Lycée Béhanzin', 'du Lycée Béhanzin'],
    ['Complexe scolaire Les Cèdres', 'du Complexe scolaire Les Cèdres'],
    ['CEG Godomey', 'du CEG Godomey'],
    ['Maternelle Les Poussins', 'de la Maternelle Les Poussins'],
    ['Cité scolaire Zogbo', 'de la Cité scolaire Zogbo'],
    ['Le Collège des Palmiers', 'du Collège des Palmiers'],
    ['La Providence', 'de la Providence'],
    ['Les Cèdres', 'des Cèdres'],
    ["L'Espoir", "de L'Espoir"],
  ])('%s', (nom, attendu) => {
    expect(deEtablissement(nom)).toBe(attendu);
  });

  it('évite la faute quand le genre est impossible à deviner (consonne, mot inconnu)', () => {
    expect(deEtablissement('Saint-Joseph')).toBe(
      'de l’établissement Saint-Joseph',
    );
    expect(deEtablissement('Notre-Dame des Apôtres')).toBe(
      'de l’établissement Notre-Dame des Apôtres',
    );
  });

  it('ignore les espaces superflus', () => {
    expect(deEtablissement('  CEG   Godomey ')).toBe('du CEG Godomey');
  });
});
