import { registerDecorator, type ValidationOptions } from 'class-validator';
import { lireDateCivile } from './est-date-naissance.validator.js';

/**
 * Règles d'une date d'inscription : date réelle, pas dans le futur, et
 * postérieure à la naissance de l'élève (quand on la connaît). Fonction pure,
 * partagée par les DTO élève, la génération de documents et l'import.
 *
 * Renvoie le message d'erreur, ou `null` si la date est valide.
 */
export function verifierDateInscription(
  dateInscription: unknown,
  dateNaissance?: string | null,
  maintenant: Date = new Date(),
): string | null {
  const lue = lireDateCivile(dateInscription, "La date d'inscription");
  if (!lue.valide) return lue.message;

  const aujourdhui = Date.UTC(
    maintenant.getUTCFullYear(),
    maintenant.getUTCMonth(),
    maintenant.getUTCDate(),
  );
  if (lue.date.getTime() > aujourdhui) {
    return "La date d'inscription ne peut pas être dans le futur.";
  }

  if (dateNaissance) {
    const naissance = lireDateCivile(dateNaissance);
    if (naissance.valide && lue.date.getTime() <= naissance.date.getTime()) {
      return "La date d'inscription doit être postérieure à la date de naissance.";
    }
  }
  return null;
}

export function EstDateInscriptionValide(
  options?: ValidationOptions,
): PropertyDecorator {
  return (objet: object, nomPropriete: string | symbol) => {
    registerDecorator({
      name: 'estDateInscriptionValide',
      target: objet.constructor,
      propertyName: String(nomPropriete),
      options,
      validator: {
        validate: (valeur: unknown, args) =>
          verifierDateInscription(
            valeur,
            (args?.object as { dateNaissance?: string })?.dateNaissance,
          ) === null,
        defaultMessage: (args) =>
          verifierDateInscription(
            args?.value,
            (args?.object as { dateNaissance?: string })?.dateNaissance,
          ) ?? '',
      },
    });
  };
}
