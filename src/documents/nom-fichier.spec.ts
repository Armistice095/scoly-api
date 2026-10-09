import { nomFichierTelechargement } from './nom-fichier.js';

const nom = nomFichierTelechargement;

describe('nomFichierTelechargement', () => {
  it('reproduit le format demandé : « <Type> - <NOM Prénoms>.pdf », sans accents', () => {
    expect(nom('Certificat de scolarité', 'Anagonou', 'Lince Junior')).toBe(
      'Certificat de scolarite - ANAGONOU Lince Junior.pdf',
    );
  });

  it('retire les accents du type, du nom et des prénoms', () => {
    expect(
      nom('Attestation d’inscription', 'Damessi', 'Kouèdji Pascaline Hortense'),
    ).toBe(
      'Attestation d inscription - DAMESSI Kouedji Pascaline Hortense.pdf',
    );
  });

  it('ramène les lettres béninoises à l’ASCII', () => {
    expect(nom('Certificat de scolarité', 'Agbɔ', 'Sɛnami Ɖéwui Ŋ')).toBe(
      'Certificat de scolarite - AGBO Senami Dewui N.pdf',
    );
    expect(nom('Fiche', 'Œdipe', 'Chloé')).toBe('Fiche - OEDIPE Chloe.pdf');
  });

  it.each(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])(
    'retire le caractère interdit sous Windows « %s »',
    (c) => {
      const resultat = nom('Certificat', `Dos${c}sou`, 'Jean');
      expect(resultat).not.toContain(c);
      expect(resultat).toBe('Certificat - DOS SOU Jean.pdf');
    },
  );

  it('retire l’apostrophe, que l’URL signée encoderait deux fois', () => {
    expect(nom('Certificat', "D'Almeida", "N'Dah Jean-Pierre")).toBe(
      'Certificat - D ALMEIDA N Dah Jean-Pierre.pdf',
    );
  });

  it('ne contient que des caractères sûrs, quoi qu’on lui donne', () => {
    const resultat = nom(
      'Certificat ✓ <b>',
      'Dos\u0000sou\n',
      '日本語 😀 Marie',
    );
    expect(resultat).toMatch(/^[A-Za-z0-9 ._-]+\.pdf$/);
  });

  it('réduit les espaces multiples et retire ceux des extrémités', () => {
    expect(
      nom('  Certificat   de   scolarité ', '  Adjaho ', ' Nadège  '),
    ).toBe('Certificat de scolarite - ADJAHO Nadege.pdf');
  });

  it('n’utilise pas le numéro unique (qui contient des « / »)', () => {
    expect(nom('Certificat', 'Adjaho', 'Nadège')).not.toContain('/');
  });

  it('limite la longueur, sans point ni espace final (refusés par Windows)', () => {
    const resultat = nom('Certificat de scolarité', 'A'.repeat(300), 'Prénom');
    expect(resultat.length).toBeLessThanOrEqual(124); // 120 + « .pdf »
    expect(resultat).toMatch(/[^ .]\.pdf$/);
  });

  it('retombe sur « Document.pdf » quand il ne reste rien d’exploitable', () => {
    expect(nom('😀', '日本', '語')).toBe('Document.pdf');
    expect(nom('', '', '')).toBe('Document.pdf');
  });
});
