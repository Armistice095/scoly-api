export type TonDecision = 'positive' | 'negative' | 'neutre';

const normaliser = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, "'");

// Une absence de problème n'est pas un problème : « sans redoublement »,
// « pas de redoublement » ne doivent pas virer au rouge.
const ABSENCE_DE_PROBLEME =
  /\b(pas de|sans|aucun|aucune)\s+(redoubl\w*|echec\w*)/g;

const NEGATIF =
  /redoubl|echec|ajourn|\bnon\s+(admis|promu|passe)|\bpas\s+(admis|promu)|\bne\s+passe\s+pas|\bn'?\s*est\s+pas\s+(admis|promu)|refus|exclu|renvoy/;

const POSITIF = /\bpass(e|er|ee|ent|age)\b|admis|admission|promu|felicit/;

/**
 * Ton d'une décision saisie en texte libre : « Passe en classe supérieure »
 * → positive (vert), « Redouble la classe » → negative (rouge), le reste →
 * neutre. Détection par mots-clés : volontairement simple et approximative.
 * Le négatif l'emporte sur le positif, et un texte ambigu ne change pas de
 * couleur plutôt que d'afficher la mauvaise.
 */
export function tonDecision(texte: string | null | undefined): TonDecision {
  if (!texte) return 'neutre';
  const t = normaliser(texte).replace(ABSENCE_DE_PROBLEME, ' ');
  if (NEGATIF.test(t)) return 'negative';
  if (POSITIF.test(t)) return 'positive';
  return 'neutre';
}
