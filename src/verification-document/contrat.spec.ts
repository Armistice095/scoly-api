/**
 * Le contrat publié à l'équipe frontend (docs/openapi-verification.yaml et
 * docs/API_VERIFICATION.md) doit dire la même chose que le code. Ce test échoue
 * dès qu'une valeur change d'un côté seulement.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  CODES_ERREUR,
  ECHECS_SAISIE_MAX,
  ETABLISSEMENT_LONGUEUR_MAX,
  FENETRE_ECHECS_MS,
  LIMITES,
  PAYS,
  REFERENCE_LONGUEUR_MAX,
  RESULTATS,
} from './constantes.js';

const lire = (chemin: string) =>
  readFileSync(new URL(chemin, import.meta.url), 'utf8');
const openapi = parse(lire('../../docs/openapi-verification.yaml'));
const markdown = lire('../../docs/API_VERIFICATION.md');
const schemas = openapi.components.schemas;
const operation = openapi.paths['/verification'].post;

describe('contrat OpenAPI ↔ code', () => {
  it('une seule route publique, POST, sans authentification', () => {
    expect(Object.keys(openapi.paths)).toEqual(['/verification']);
    expect(Object.keys(openapi.paths['/verification'])).toEqual(['post']);
    expect(operation.security).toEqual([]);
  });

  it('les résultats documentés sont ceux du code, AMBIGU compris', () => {
    expect(schemas.VerificationResponse.properties.resultat.enum).toEqual([
      ...RESULTATS,
    ]);
    expect(RESULTATS).toContain('AMBIGU');
    expect(
      Object.keys(
        operation.responses['200'].content['application/json'].examples,
      ).sort(),
    ).toEqual(['ambigu', 'annule', 'introuvable', 'valide']);
  });

  it('les codes d’erreur documentés sont ceux du code', () => {
    expect(schemas.Erreur.properties.code.enum).toEqual(
      Object.values(CODES_ERREUR),
    );
    for (const code of Object.values(CODES_ERREUR))
      expect(markdown).toContain(`\`${code}\``);
  });

  it('les codes HTTP documentés', () => {
    expect(Object.keys(operation.responses)).toEqual([
      '200',
      '400',
      '429',
      '500',
    ]);
  });

  it('les limites de taille documentées', () => {
    const { reference, etablissement } = schemas.VerificationRequest.properties;
    expect(reference.maxLength).toBe(REFERENCE_LONGUEUR_MAX);
    expect(etablissement.maxLength).toBe(ETABLISSEMENT_LONGUEUR_MAX);
  });

  it('les limites de débit documentées', () => {
    const doc = operation['x-limites-de-debit'];
    expect(doc.saisie).toEqual({
      minute: LIMITES.saisie.minute.limite,
      heure: LIMITES.saisie.heure.limite,
    });
    expect(doc.qr).toEqual({
      minute: LIMITES.qr.minute.limite,
      heure: LIMITES.qr.heure.limite,
    });
    expect(doc.echecsSaisieAvantBlocage).toBe(ECHECS_SAISIE_MAX);
    expect(doc.fenetreEchecsMinutes).toBe(FENETRE_ECHECS_MS / 60_000);
    // Le tableau lisible du document Markdown dit la même chose.
    expect(markdown).toContain(
      `| Saisie manuelle (\`reference\`) | ${LIMITES.saisie.minute.limite} | ${LIMITES.saisie.heure.limite} |`,
    );
    expect(markdown).toContain(
      `| QR code (\`token\`) | ${LIMITES.qr.minute.limite} | ${LIMITES.qr.heure.limite} |`,
    );
    expect(markdown).toContain(
      `**${ECHECS_SAISIE_MAX} références introuvables ou ambiguës en ${FENETRE_ECHECS_MS / 60_000} minutes**`,
    );
  });

  it('le pays documenté est celui renvoyé', () => {
    expect(schemas.EtablissementPublic.properties.pays.example).toBe(PAYS);
  });

  it('la liste des champs de la réponse = liste blanche du code (rien de plus)', () => {
    expect(schemas.VerificationResponse.required.sort()).toEqual([
      'document',
      'etablissement',
      'resultat',
      'verifieLe',
    ]);
    expect(Object.keys(schemas.DocumentPublic.properties).sort()).toEqual([
      'dateAnnulation',
      'dateEmission',
      'eleve',
      'reference',
      'typeDocument',
    ]);
    expect(Object.keys(schemas.EtablissementPublic.properties).sort()).toEqual([
      'email',
      'localite',
      'nom',
      'pays',
      'telephone',
    ]);
  });

  it('le corps n’accepte que token, reference, etablissement', () => {
    expect(schemas.VerificationRequest.additionalProperties).toBe(false);
    expect(Object.keys(schemas.VerificationRequest.properties)).toEqual([
      'token',
      'reference',
      'etablissement',
    ]);
  });

  it('le document destiné au front signale AMBIGU en tête', () => {
    const debut = markdown.slice(0, markdown.indexOf('## 1. Vue d'));
    expect(debut).toContain('AMBIGU');
    expect(debut).toMatch(/Créer un 5ᵉ écran/);
  });
});
