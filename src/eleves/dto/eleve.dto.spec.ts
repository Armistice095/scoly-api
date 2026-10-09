import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreerEleveDto } from './creer-eleve.dto.js';
import { ModifierEleveDto } from './modifier-eleve.dto.js';

// Le client Prisma n'est pas généré dans tous les environnements de test :
// on ne dépend que des valeurs d'enum.
vi.mock('@prisma/client', () => ({
  Sexe: { MASCULIN: 'MASCULIN', FEMININ: 'FEMININ' },
  StatutEleve: { ACTIF: 'ACTIF' },
}));

const valide = {
  nom: '  Adjaho ',
  prenoms: 'Nadège',
  sexe: 'FEMININ',
  dateNaissance: '2014-07-15',
  lieuNaissance: 'Cotonou',
  parentTuteur: 'M. Basile Hounkpatin',
  telephone: '+229 01 97 16 46 76',
};

const options = { whitelist: true, forbidNonWhitelisted: true };
const messages = (classe: new () => object, donnees: object) =>
  validateSync(plainToInstance(classe, donnees) as object, options).flatMap(
    (e) => Object.values(e.constraints ?? {}),
  );

describe('CreerEleveDto', () => {
  it('accepte un élève valide et nettoie les champs', () => {
    const dto = plainToInstance(CreerEleveDto, valide);
    expect(validateSync(dto, options)).toHaveLength(0);
    expect(dto.nom).toBe('Adjaho');
    expect(dto.telephone).toBe('+2290197164676');
  });

  it('transforme les matricules/adresse vides en null', () => {
    const dto = plainToInstance(CreerEleveDto, {
      ...valide,
      matricule: '  ',
      matriculeEducMaster: '',
      adresse: '',
    });
    expect(validateSync(dto, options)).toHaveLength(0);
    expect(dto.matricule).toBeNull();
    expect(dto.matriculeEducMaster).toBeNull();
    expect(dto.adresse).toBeNull();
  });

  it('signale chaque champ obligatoire manquant', () => {
    const erreurs = messages(CreerEleveDto, {});
    expect(erreurs).toEqual(
      expect.arrayContaining([
        'Le nom est obligatoire.',
        'Les prénoms sont obligatoires.',
        'Le lieu de naissance est obligatoire.',
        'Le parent ou tuteur est obligatoire.',
        'Le téléphone est obligatoire.',
      ]),
    );
  });

  it('refuse un sexe inconnu, un téléphone invalide et un champ non déclaré', () => {
    const erreurs = messages(CreerEleveDto, {
      ...valide,
      sexe: 'X',
      telephone: '1234',
      statut: 'PARTI',
    });
    expect(erreurs.join(' ')).toMatch(/sexe/i);
    expect(erreurs.join(' ')).toMatch(/téléphone/i);
    expect(erreurs.join(' ')).toMatch(/statut/);
  });
});

describe('ModifierEleveDto', () => {
  it('accepte une mise à jour partielle', () => {
    expect(messages(ModifierEleveDto, { lieuNaissance: 'Ouidah' })).toEqual([]);
    expect(messages(ModifierEleveDto, {})).toEqual([]);
  });

  it('refuse d’effacer un champ obligatoire (null ou vide)', () => {
    expect(messages(ModifierEleveDto, { nom: null }).length).toBeGreaterThan(0);
    expect(
      messages(ModifierEleveDto, { telephone: '' }).length,
    ).toBeGreaterThan(0);
  });

  it('permet d’effacer un champ facultatif', () => {
    const dto = plainToInstance(ModifierEleveDto, {
      adresse: null,
      matricule: '',
    });
    expect(validateSync(dto, options)).toHaveLength(0);
    expect(dto.matricule).toBeNull();
  });
});

describe('classe et date d’inscription (facultatives)', () => {
  it('sont absentes par défaut, et acceptées quand valides', () => {
    expect(messages(CreerEleveDto, valide)).toEqual([]);
    const dto = plainToInstance(CreerEleveDto, {
      ...valide,
      classe: '  3ème A ',
      dateInscription: '2023-06-22',
    });
    expect(validateSync(dto, options)).toHaveLength(0);
    expect(dto.classe).toBe('3ème A');
  });

  it('une valeur vide devient null', () => {
    const dto = plainToInstance(CreerEleveDto, {
      ...valide,
      classe: '',
      dateInscription: '',
    });
    expect(validateSync(dto, options)).toHaveLength(0);
    expect(dto.classe).toBeNull();
    expect(dto.dateInscription).toBeNull();
  });

  it('refuse une date d’inscription invalide, future ou antérieure à la naissance', () => {
    const erreur = (dateInscription: string) =>
      messages(CreerEleveDto, { ...valide, dateInscription }).join(' ');
    expect(erreur('2023-02-30')).toMatch(/invalide/);
    expect(erreur('2999-01-01')).toMatch(/futur/);
    expect(erreur('2010-01-01')).toMatch(/postérieure/); // naissance 2014-07-15
  });

  it('refuse une classe trop longue', () => {
    expect(
      messages(CreerEleveDto, { ...valide, classe: 'x'.repeat(31) }).join(' '),
    ).toMatch(/30 caractères/);
  });

  it('s’efface avec null en modification', () => {
    const dto = plainToInstance(ModifierEleveDto, {
      classe: null,
      dateInscription: null,
    });
    expect(validateSync(dto, options)).toHaveLength(0);
  });
});
