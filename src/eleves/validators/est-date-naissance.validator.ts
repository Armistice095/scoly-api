import { registerDecorator, type ValidationOptions } from 'class-validator';

export const AGE_MIN_ANS = 2;
export const AGE_MAX_ANS = 30;

export type ResultatDateCivile =
  | { valide: true; date: Date; annee: number; mois: number; jour: number }
  | { valide: false; message: string };

/**
 * Lit une date civile AAAA-MM-JJ stricte (jour réel du calendrier, calculée
 * en UTC : aucune heure, donc aucun décalage de fuseau).
 */
export function lireDateCivile(
  valeur: unknown,
  libelle = 'La date',
): ResultatDateCivile {
  const format = `${libelle} est invalide (format attendu : AAAA-MM-JJ).`;
  if (typeof valeur !== 'string') return { valide: false, message: format };

  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur);
  if (!correspondance) return { valide: false, message: format };

  const [annee, mois, jour] = correspondance.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(annee, mois - 1, jour));

  // Rejette les dates qui « débordent » (ex. 2014-02-30 devient 2014-03-02).
  if (
    date.getUTCFullYear() !== annee ||
    date.getUTCMonth() !== mois - 1 ||
    date.getUTCDate() !== jour
  ) {
    return { valide: false, message: format };
  }
  return { valide: true, date, annee, mois, jour };
}

export type ResultatDateNaissance =
  { valide: true; date: Date } | { valide: false; message: string };

/**
 * Analyse une date de naissance au format strict AAAA-MM-JJ. Tout est calculé
 * en UTC : la date de naissance est une date « civile » sans heure (colonne
 * @db.Date), on évite donc tout décalage lié au fuseau du serveur.
 */
export function analyserDateNaissance(
  valeur: unknown,
  maintenant: Date = new Date(),
): ResultatDateNaissance {
  const lue = lireDateCivile(valeur, 'La date de naissance');
  if (!lue.valide) return lue;
  const { date, annee, mois, jour } = lue;

  const aujourdhui = Date.UTC(
    maintenant.getUTCFullYear(),
    maintenant.getUTCMonth(),
    maintenant.getUTCDate(),
  );
  if (date.getTime() > aujourdhui) {
    return {
      valide: false,
      message: 'La date de naissance ne peut pas être dans le futur.',
    };
  }

  let age = maintenant.getUTCFullYear() - annee;
  const anniversairePasse =
    maintenant.getUTCMonth() + 1 > mois ||
    (maintenant.getUTCMonth() + 1 === mois && maintenant.getUTCDate() >= jour);
  if (!anniversairePasse) age -= 1;

  if (age < AGE_MIN_ANS || age > AGE_MAX_ANS) {
    return {
      valide: false,
      message: `L'âge de l'élève doit être compris entre ${AGE_MIN_ANS} et ${AGE_MAX_ANS} ans.`,
    };
  }

  return { valide: true, date };
}

export function EstDateNaissanceValide(
  options?: ValidationOptions,
): PropertyDecorator {
  return (objet: object, nomPropriete: string | symbol) => {
    registerDecorator({
      name: 'estDateNaissanceValide',
      target: objet.constructor,
      propertyName: String(nomPropriete),
      options,
      validator: {
        validate: (valeur: unknown) => analyserDateNaissance(valeur).valide,
        defaultMessage: (args) => {
          const resultat = analyserDateNaissance(args?.value);
          return resultat.valide ? '' : resultat.message;
        },
      },
    });
  };
}
