import { lireDateCivile } from '../../eleves/validators/est-date-naissance.validator.js';
import type { ErreurChamp } from '../../common/validation/erreurs-validation.js';
import type {
  ChampDefinition,
  ContexteValidation,
  TypeDocumentDefinition,
} from './definitions.js';

const MAX_PAR_DEFAUT = 150;

/** Retire les caractères de contrôle (sauf retour à la ligne), normalise les sauts de ligne et limite les lignes vides. */
function nettoyerTexte(valeur: string, multiligne: boolean): string {
  const sansControle = valeur
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (!multiligne) return sansControle.replace(/\s+/g, ' ').trim();
  return sansControle
    .split('\n')
    .map((ligne) => ligne.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function validerUnChamp(
  champ: ChampDefinition,
  brut: unknown,
  definition: TypeDocumentDefinition,
  contexte: ContexteValidation,
): { valeur: string; erreur?: string } {
  const absent = brut === undefined || brut === null;
  if (!absent && typeof brut !== 'string') {
    return { valeur: '', erreur: `${champ.libelle} est invalide.` };
  }

  const valeur = absent
    ? ''
    : nettoyerTexte(brut as string, champ.type === 'textarea');

  if (valeur === '') {
    return champ.obligatoire
      ? { valeur, erreur: `${champ.libelle} est obligatoire.` }
      : { valeur };
  }

  const max = champ.maxLength ?? MAX_PAR_DEFAUT;
  if (valeur.length > max) {
    return {
      valeur,
      erreur: `${champ.libelle} ne doit pas dépasser ${max} caractères.`,
    };
  }

  if (champ.type === 'select' && !champ.options?.includes(valeur)) {
    return {
      valeur,
      erreur: `${champ.libelle} : valeur non autorisée (${champ.options?.join(', ')}).`,
    };
  }

  if (champ.type === 'date') {
    const lue = lireDateCivile(valeur, champ.libelle);
    if (!lue.valide) return { valeur, erreur: lue.message };
  }

  const regle = definition.validerChamp?.(champ, valeur, contexte);
  if (regle) return { valeur, erreur: regle };

  return { valeur };
}

/**
 * Valide les champs saisis selon la définition du type. Retourne les valeurs
 * nettoyées (seulement celles non vides) ou les erreurs au format
 * `{ champ: 'champsSaisis.<cle>', message }`. Un champ inconnu est refusé :
 * rien d'imprévu ne se retrouve dans le document.
 */
export function validerChampsSaisis(
  definition: TypeDocumentDefinition,
  champsSaisis: unknown,
  contexte: ContexteValidation,
):
  | { ok: true; champs: Record<string, string> }
  | { ok: false; erreurs: ErreurChamp[] } {
  const entree =
    champsSaisis &&
    typeof champsSaisis === 'object' &&
    !Array.isArray(champsSaisis)
      ? (champsSaisis as Record<string, unknown>)
      : {};

  const erreurs: ErreurChamp[] = [];
  const champs: Record<string, string> = {};

  for (const cle of Object.keys(entree)) {
    if (!definition.champs.some((c) => c.cle === cle)) {
      erreurs.push({
        champ: `champsSaisis.${cle}`,
        message: `Le champ « ${cle} » n'est pas autorisé pour ce type de document.`,
      });
    }
  }

  for (const champ of definition.champs) {
    const { valeur, erreur } = validerUnChamp(
      champ,
      entree[champ.cle],
      definition,
      contexte,
    );
    if (erreur) {
      erreurs.push({ champ: `champsSaisis.${champ.cle}`, message: erreur });
    } else if (valeur !== '') {
      champs[champ.cle] = valeur;
    }
  }

  return erreurs.length > 0 ? { ok: false, erreurs } : { ok: true, champs };
}
