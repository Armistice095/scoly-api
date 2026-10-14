import {
  DEPARTEMENTS_OFFICIELS,
  DEVISE_OFFICIELLE,
  enteteParDefaut,
  MINISTERE_PAR_ORDRE,
  recalerEntete,
} from './entete-officielle.js';

const MEMP = 'Ministère des Enseignements Maternel et Primaire (MEMP)';
const MESTFP =
  'Ministère des Enseignements Secondaires, Technique et de la Formation Professionnelle (MESTFP)';
const DIR_MEMP =
  'Direction Départementale des Enseignements Maternel et Primaire';
const DIR_MESTFP =
  'Direction Départementale des Enseignements Secondaires, Technique et de la Formation Professionnelle';

// Attendus écrits à la main (pas recalculés par le code testé) :
// [département, préposition + nom, sigle].
const ATTENDUS: [string, string, string][] = [
  ['Alibori', 'de l’Alibori', 'ALIBORI'],
  ['Atacora', 'de l’Atacora', 'ATACORA'],
  ['Atlantique', 'de l’Atlantique', 'ATLANTIQUE'],
  ['Borgou', 'du Borgou', 'BORGOU'],
  ['Collines', 'des Collines', 'COLLINES'],
  ['Couffo', 'du Couffo', 'COUFFO'],
  ['Donga', 'de la Donga', 'DONGA'],
  ['Littoral', 'du Littoral', 'LITTORAL'],
  ['Mono', 'du Mono', 'MONO'],
  ['Ouémé', 'de l’Ouémé', 'OUÉMÉ'],
  ['Plateau', 'du Plateau', 'PLATEAU'],
  ['Zou', 'du Zou', 'ZOU'],
];

describe('enteteParDefaut', () => {
  it('couvre exactement les 12 départements du Bénin', () => {
    expect(DEPARTEMENTS_OFFICIELS.map((d) => d.nom).sort()).toEqual(
      ATTENDUS.map(([nom]) => nom).sort(),
    );
  });

  describe.each(ATTENDUS)('%s', (dept, prepositionNom, sigle) => {
    it('MEMP (primaire)', () => {
      expect(enteteParDefaut('PRIMAIRE', dept)).toEqual({
        ministereTutelle: MEMP,
        directionDepartementale: `${DIR_MEMP} ${prepositionNom} (DDEMP-${sigle})`,
        devise: 'Fraternité - Justice - Travail',
      });
    });

    it('MESTFP (secondaire)', () => {
      expect(enteteParDefaut('SECONDAIRE', dept)).toEqual({
        ministereTutelle: MESTFP,
        directionDepartementale: `${DIR_MESTFP} ${prepositionNom} (DDESTFP-${sigle})`,
        devise: 'Fraternité - Justice - Travail',
      });
    });
  });

  it('critère d’acceptation : primaire du Couffo', () => {
    expect(enteteParDefaut('PRIMAIRE', 'Couffo')).toEqual({
      ministereTutelle:
        'Ministère des Enseignements Maternel et Primaire (MEMP)',
      directionDepartementale:
        'Direction Départementale des Enseignements Maternel et Primaire du Couffo (DDEMP-COUFFO)',
      devise: 'Fraternité - Justice - Travail',
    });
  });

  it('critère d’acceptation : secondaire du Mono', () => {
    expect(enteteParDefaut('SECONDAIRE', 'Mono').directionDepartementale).toBe(
      'Direction Départementale des Enseignements Secondaires, Technique et de la Formation Professionnelle du Mono (DDESTFP-MONO)',
    );
  });

  it('la maternelle relève du MEMP, comme le primaire', () => {
    expect(enteteParDefaut('MATERNELLE', 'Zou')).toEqual(
      enteteParDefaut('PRIMAIRE', 'Zou'),
    );
    expect(MINISTERE_PAR_ORDRE).toEqual({
      MATERNELLE: 'MEMP',
      PRIMAIRE: 'MEMP',
      SECONDAIRE: 'MESTFP',
    });
  });

  it('reconnaît le département sans tenir compte de la casse, des accents ni des espaces', () => {
    const attendu = enteteParDefaut('PRIMAIRE', 'Ouémé');
    expect(enteteParDefaut('PRIMAIRE', 'OUEME')).toEqual(attendu);
    expect(enteteParDefaut('PRIMAIRE', '  ouémé ')).toEqual(attendu);
  });

  it('ne devine jamais : département inconnu ou absent → pas de direction', () => {
    expect(
      enteteParDefaut('PRIMAIRE', 'Narnia').directionDepartementale,
    ).toBeNull();
    expect(enteteParDefaut('PRIMAIRE', '').directionDepartementale).toBeNull();
    expect(enteteParDefaut('PRIMAIRE', null).ministereTutelle).toBe(MEMP);
  });

  it('ordre absent → ni ministère ni direction, mais la devise reste fournie', () => {
    expect(enteteParDefaut(undefined, 'Mono')).toEqual({
      ministereTutelle: null,
      directionDepartementale: null,
      devise: DEVISE_OFFICIELLE,
    });
  });
});

describe('recalerEntete', () => {
  const auto = enteteParDefaut('PRIMAIRE', 'Couffo');
  const base = {
    ordreEnseignement: 'PRIMAIRE' as const,
    departement: 'Couffo',
    ...auto,
  };

  it('ne fait rien si ni l’ordre ni le département ne change', () => {
    expect(recalerEntete(base, { departement: 'Couffo' })).toEqual({});
    expect(recalerEntete(base, {})).toEqual({});
  });

  it('suit un changement d’ordre : champs automatiques recalés, devise inchangée', () => {
    const r = recalerEntete(base, { ordreEnseignement: 'SECONDAIRE' });
    expect(r.ministereTutelle).toBe(MESTFP);
    expect(r.directionDepartementale).toBe(
      enteteParDefaut('SECONDAIRE', 'Couffo').directionDepartementale,
    );
    expect(r.devise).toBe(DEVISE_OFFICIELLE);
  });

  it('suit un changement de département', () => {
    const r = recalerEntete(base, { departement: 'Mono' });
    expect(r.directionDepartementale).toContain('du Mono (DDEMP-MONO)');
    expect(r.ministereTutelle).toBe(MEMP);
  });

  it('n’écrase JAMAIS une valeur personnalisée', () => {
    const perso = {
      ...base,
      directionDepartementale: 'DDEMP Couffo (nouvel intitulé)',
    };
    const r = recalerEntete(perso, { departement: 'Mono' });
    expect(r).not.toHaveProperty('directionDepartementale');
    expect(r.ministereTutelle).toBe(MEMP);
  });

  it('respecte un champ envoyé explicitement dans la même requête', () => {
    const r = recalerEntete(base, {
      ordreEnseignement: 'SECONDAIRE',
      ministereTutelle: 'Intitulé officiel modifié',
    });
    expect(r).not.toHaveProperty('ministereTutelle');
    expect(r.directionDepartementale).toBeDefined();
  });

  it('remplit les champs vides (établissement existant sans en-tête)', () => {
    const vide = {
      ordreEnseignement: 'PRIMAIRE' as const,
      departement: 'Couffo',
      ministereTutelle: null,
      directionDepartementale: '  ',
      devise: null,
    };
    const r = recalerEntete(vide, { departement: 'Mono' });
    expect(r.ministereTutelle).toBe(MEMP);
    expect(r.directionDepartementale).toContain('(DDEMP-MONO)');
    expect(r.devise).toBe(DEVISE_OFFICIELLE);
  });

  it('ne remplace pas par du vide quand la nouvelle valeur est inconnue', () => {
    const r = recalerEntete(base, { departement: 'Narnia' });
    expect(r).not.toHaveProperty('directionDepartementale');
  });
});
