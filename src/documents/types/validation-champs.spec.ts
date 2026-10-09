import { CERTIFICAT_SCOLARITE } from './certificat-scolarite.js';
import { validerChampsSaisis } from './validation-champs.js';

const contexte = { eleve: { dateNaissance: '2014-07-15' } };
const valides = {
  classe: 'CE1',
  dateInscription: '2023-06-22',
  assiduite: 'Bonne',
  conduite: 'Bonne',
  travail: 'Satisfaisant',
};

const valider = (champs: unknown) =>
  validerChampsSaisis(CERTIFICAT_SCOLARITE, champs, contexte);

describe('validerChampsSaisis (certificat de scolarité)', () => {
  it('accepte des champs valides et omet l’observation vide', () => {
    expect(valider({ ...valides, observations: '   ' })).toEqual({
      ok: true,
      champs: valides,
    });
  });

  it('nettoie les espaces et garde les retours à la ligne des observations', () => {
    const r = valider({
      ...valides,
      classe: '  3ème   A ',
      observations: 'Passe en classe\r\nsupérieure \n\n\n\nBravo',
    });
    expect(r).toMatchObject({
      ok: true,
      champs: {
        classe: '3ème A',
        observations: 'Passe en classe\nsupérieure\n\nBravo',
      },
    });
  });

  it('exige les champs obligatoires, un message par champ', () => {
    const r = valider({});
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.erreurs).toEqual([
      { champ: 'champsSaisis.classe', message: 'Classe est obligatoire.' },
      {
        champ: 'champsSaisis.dateInscription',
        message: "Date d'inscription est obligatoire.",
      },
      {
        champ: 'champsSaisis.assiduite',
        message: 'Assiduité est obligatoire.',
      },
      { champ: 'champsSaisis.conduite', message: 'Conduite est obligatoire.' },
      { champ: 'champsSaisis.travail', message: 'Travail est obligatoire.' },
    ]);
  });

  it('refuse une valeur hors de la liste (échelles du back)', () => {
    const r = valider({
      ...valides,
      assiduite: 'Satisfaisant',
      travail: 'Bonne',
    });
    const champs = r.ok ? [] : r.erreurs.map((e) => e.champ);
    expect(champs).toEqual(['champsSaisis.assiduite', 'champsSaisis.travail']);
  });

  it('refuse un champ inconnu et un type invalide', () => {
    const r = valider({ ...valides, statut: 'x', classe: 12 });
    const erreurs = r.ok ? [] : r.erreurs;
    expect(erreurs.map((e) => e.champ).sort()).toEqual([
      'champsSaisis.classe',
      'champsSaisis.statut',
    ]);
  });

  it('applique les longueurs maximales', () => {
    const r = valider({ ...valides, observations: 'x'.repeat(301) });
    expect(r.ok ? [] : r.erreurs).toEqual([
      {
        champ: 'champsSaisis.observations',
        message:
          'Observations particulières / Décision ne doit pas dépasser 300 caractères.',
      },
    ]);
  });

  it('contrôle la date d’inscription : réelle, pas future, après la naissance', () => {
    const message = (dateInscription: string) => {
      const r = valider({ ...valides, dateInscription });
      return r.ok ? null : r.erreurs[0]?.message;
    };
    expect(message('2023-02-30')).toMatch(/invalide/);
    expect(message('2999-01-01')).toMatch(/futur/);
    expect(message('2014-07-15')).toMatch(/postérieure à la date de naissance/);
    expect(message('2023-06-22')).toBeNull();
  });

  it('supprime les caractères de contrôle', () => {
    const r = valider({ ...valides, classe: 'CE1\u0000\u0007' });
    expect(r).toMatchObject({ ok: true, champs: { classe: 'CE1' } });
  });
});
