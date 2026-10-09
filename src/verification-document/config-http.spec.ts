import { lireTrustProxy, optionsCors } from './config-http.js';

const env = { CORS_ORIGIN: 'https://app.scoly.bj' };

describe('optionsCors', () => {
  it('hors vérification : configuration historique inchangée', () => {
    for (const url of [
      '/archives',
      '/auth/login',
      '/documents/x/telecharger',
      '/verification-email',
      '/verification/abc',
    ]) {
      expect(optionsCors(url, env)).toEqual({
        origin: 'https://app.scoly.bj',
        credentials: true,
      });
    }
    expect(optionsCors('/archives', {})).toEqual({
      origin: 'http://localhost:5173',
      credentials: true,
    });
  });

  it('/verification : POST seul, sans credentials, origine configurée', () => {
    for (const url of [
      '/verification',
      '/verification/',
      '/verification?x=1',
    ]) {
      expect(optionsCors(url, env)).toMatchObject({
        origin: ['https://app.scoly.bj'],
        methods: ['POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
        credentials: false,
      });
    }
  });

  it('VERIFICATION_CORS_ORIGIN prime et accepte une liste', () => {
    expect(
      optionsCors('/verification', {
        ...env,
        VERIFICATION_CORS_ORIGIN:
          'https://verifier.scoly.bj, https://scoly.bj ,',
      }).origin,
    ).toEqual(['https://verifier.scoly.bj', 'https://scoly.bj']);
  });
});

describe('lireTrustProxy', () => {
  it('par défaut : aucune confiance', () => {
    for (const v of [undefined, '', ' ', 'false', '0'])
      expect(lireTrustProxy(v)).toBe(false);
  });
  it('nombre de sauts', () => {
    expect(lireTrustProxy('1')).toBe(1);
    expect(lireTrustProxy(' 2 ')).toBe(2);
  });
  it('refuse la confiance totale (IP forgeable)', () => {
    expect(() => lireTrustProxy('true')).toThrow(/TRUST_PROXY/);
  });
  it('transmet un réglage Express avancé', () => {
    expect(lireTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});
