/**
 * Test d'intégration HTTP : le VRAI module (guard de débit, helmet, filtre,
 * contrôleur, service) derrière les mêmes pipe et CORS que main.ts. Seule la
 * base est simulée.
 */
import {
  Global,
  Module,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { creerExceptionValidation } from '../common/validation/erreurs-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { optionsCors } from './config-http.js';
import { LIMITES } from './constantes.js';
import { VerificationDocumentModule } from './verification-document.module.js';
import {
  documentAnnule,
  documentBrut,
  TOKEN,
} from '../../test/fixtures/verification-document.js';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));

const ORIGINE = 'https://verifier.scoly.bj';

function creerPrisma() {
  return {
    document: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    journalVerification: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

async function demarrer(prisma = creerPrisma()) {
  @Global()
  @Module({
    providers: [{ provide: PrismaService, useValue: prisma }],
    exports: [PrismaService],
  })
  class PrismaFactice {}

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaFactice,
      VerificationDocumentModule,
    ],
  }).compile();

  const app: INestApplication = module.createNestApplication();
  // Même configuration que src/main.ts.
  app.enableCors(
    (req: { url?: string }, cb: (e: Error | null, o: object) => void) =>
      cb(
        null,
        optionsCors(req.url, {
          CORS_ORIGIN: 'https://app.scoly.bj',
          VERIFICATION_CORS_ORIGIN: ORIGINE,
        }),
      ),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: creerExceptionValidation,
    }),
  );
  await app.init();
  return { app, prisma, http: () => request(app.getHttpServer()) };
}

let ctx: Awaited<ReturnType<typeof demarrer>>;
beforeEach(async () => {
  ctx = await demarrer();
});
afterEach(async () => {
  await ctx.app.close();
});

describe('POST /verification — succès', () => {
  it('QR valide : 200, forme du contrat, aucun cache, en-têtes de sécurité', async () => {
    ctx.prisma.document.findUnique.mockResolvedValue(documentBrut());

    const res = await ctx
      .http()
      .post('/verification')
      .send({ token: TOKEN })
      .expect(200);

    expect(res.body).toMatchObject({
      resultat: 'VALIDE',
      document: {
        eleve: 'Adjovi A.',
        reference: 'N°0042/2025-2026/CEG-GODOMEY',
      },
      etablissement: {
        localite: 'Abomey-Calavi, Atlantique',
        pays: 'République du Bénin',
      },
    });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('saisie annulée : 200 ANNULE', async () => {
    ctx.prisma.document.findMany.mockResolvedValue([documentAnnule()]);
    const res = await ctx
      .http()
      .post('/verification')
      .send({ reference: 'n° 42/2025-2026/ceg-godomey' })
      .expect(200);
    expect(res.body.resultat).toBe('ANNULE');
    expect(res.body.document.dateAnnulation).toBe('2026-10-01');
  });

  it('INTROUVABLE (QR et saisie) et AMBIGU : 200, même enveloppe vide', async () => {
    ctx.prisma.document.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([documentBrut(), documentBrut({ id: 'x' })]);
    const qr = await ctx
      .http()
      .post('/verification')
      .send({ token: TOKEN })
      .expect(200);
    const saisie = await ctx
      .http()
      .post('/verification')
      .send({ reference: 'N°9/2025' })
      .expect(200);
    const ambigu = await ctx
      .http()
      .post('/verification')
      .send({ reference: 'N°42/2025' })
      .expect(200);

    expect(qr.body.resultat).toBe('INTROUVABLE');
    expect(saisie.body.resultat).toBe('INTROUVABLE');
    expect(ambigu.body.resultat).toBe('AMBIGU');
    for (const r of [qr, saisie, ambigu]) {
      expect(Object.keys(r.body).sort()).toEqual([
        'document',
        'etablissement',
        'resultat',
        'verifieLe',
      ]);
      expect(r.body.document).toBeNull();
      expect(r.body.etablissement).toBeNull();
    }
  });

  it('ne dépend d’aucun cookie ni en-tête d’authentification', async () => {
    ctx.prisma.document.findUnique.mockResolvedValue(documentBrut());
    await ctx
      .http()
      .post('/verification')
      .set('Authorization', 'Bearer invalide')
      .send({ token: TOKEN })
      .expect(200);
  });
});

describe('POST /verification — erreurs 400', () => {
  it.each([
    ['corps vide', {}, 'CHAMP_VIDE'],
    ['référence vide', { reference: '   ' }, 'CHAMP_VIDE'],
    ['référence sans chiffre', { reference: 'CEG GODOMEY' }, 'FORMAT_INVALIDE'],
    [
      'token et référence',
      { token: TOKEN, reference: 'N°1/2025' },
      'FORMAT_INVALIDE',
    ],
    [
      'champ inconnu',
      { reference: 'N°1/2025', admin: true },
      'VALIDATION_ERROR',
    ],
    ['référence non textuelle', { reference: 42 }, 'VALIDATION_ERROR'],
    [
      'référence démesurée',
      { reference: `N°1/${'A'.repeat(5000)}` },
      'VALIDATION_ERROR',
    ],
  ])('%s → 400 %s', async (_cas, corps, code) => {
    const res = await ctx.http().post('/verification').send(corps).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, code });
    expect(res.body.erreurs[0]).toEqual({
      champ: expect.any(String),
      message: expect.any(String),
    });
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(ctx.prisma.document.findMany).not.toHaveBeenCalled();
  });

  it('JSON invalide → 400', async () => {
    await ctx
      .http()
      .post('/verification')
      .set('Content-Type', 'application/json')
      .send('{"reference":')
      .expect(400);
  });

  it('GET n’existe pas : une référence ne transite jamais par l’URL', async () => {
    await ctx.http().get('/verification?reference=N°1/2025').expect(404);
    await ctx.http().get(`/verification/${TOKEN}`).expect(404);
  });
});

describe('POST /verification — erreur serveur', () => {
  it('500 ERREUR_SERVEUR sans détail technique ni valeur saisie', async () => {
    ctx.prisma.document.findMany.mockRejectedValue(
      new Error(
        'Invalid prisma.document.findMany() invocation: referenceNormalisee: "42 2025 secret"',
      ),
    );
    const res = await ctx
      .http()
      .post('/verification')
      .send({ reference: 'N°42/2025' })
      .expect(500);
    expect(res.body).toEqual({
      statusCode: 500,
      code: 'ERREUR_SERVEUR',
      message: expect.stringContaining('momentanément indisponible'),
    });
    expect(JSON.stringify(res.body)).not.toContain('prisma');
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});

describe('POST /verification — limitation de débit (429)', () => {
  it('saisie : bloquée au-delà de la limite par minute, avec Retry-After et retryAfterSecondes', async () => {
    const { limite } = LIMITES.saisie.minute;
    for (let i = 0; i < limite; i++) {
      await ctx
        .http()
        .post('/verification')
        .send({ reference: `N°${i + 1}/2025` })
        .expect(200);
    }
    const res = await ctx
      .http()
      .post('/verification')
      .send({ reference: 'N°99/2025' })
      .expect(429);

    expect(res.body).toMatchObject({
      statusCode: 429,
      code: 'TROP_DE_REQUETES',
    });
    expect(res.body.retryAfterSecondes).toBeGreaterThan(0);
    expect(res.headers['retry-after']).toBe(
      String(res.body.retryAfterSecondes),
    );
    expect(
      Object.keys(res.headers).some((h) => h.startsWith('x-ratelimit')),
    ).toBe(false);
  });

  it('un visiteur bloqué en saisie peut encore ouvrir ses QR (compteurs séparés)', async () => {
    for (let i = 0; i < LIMITES.saisie.minute.limite + 1; i++) {
      await ctx
        .http()
        .post('/verification')
        .send({ reference: `N°${i + 1}/2025` });
    }
    await ctx.http().post('/verification').send({ token: TOKEN }).expect(200);
  });

  it('ralentissement progressif sur échecs (en base) → 429 sans lire les documents', async () => {
    ctx.prisma.journalVerification.count.mockResolvedValue(15);
    const res = await ctx
      .http()
      .post('/verification')
      .send({ reference: 'N°1/2025' })
      .expect(429);
    expect(res.body).toMatchObject({
      code: 'TROP_DE_REQUETES',
      retryAfterSecondes: 600,
    });
    expect(res.headers['retry-after']).toBe('600');
    expect(ctx.prisma.document.findMany).not.toHaveBeenCalled();
  });
});

describe('CORS', () => {
  it('préflight depuis la page de vérification : autorisé, POST, sans credentials', async () => {
    const res = await ctx
      .http()
      .options('/verification')
      .set('Origin', ORIGINE)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.headers['access-control-allow-origin']).toBe(ORIGINE);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers['access-control-allow-methods']).toBe('POST,OPTIONS');
  });

  it('autre origine : aucune autorisation', async () => {
    const res = await ctx
      .http()
      .post('/verification')
      .set('Origin', 'https://site-malveillant.example')
      .send({ token: TOKEN });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('l’origine de l’application (autorisée ailleurs) n’est pas ouverte ici', async () => {
    const res = await ctx
      .http()
      .post('/verification')
      .set('Origin', 'https://app.scoly.bj')
      .send({ token: TOKEN });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('traçabilité', () => {
  it('journalise canal, résultat et IP hachée — jamais la référence, le jeton ni l’IP', async () => {
    ctx.prisma.document.findUnique.mockResolvedValue(documentBrut());
    await ctx.http().post('/verification').send({ token: TOKEN }).expect(200);
    await vi.waitFor(() =>
      expect(ctx.prisma.journalVerification.create).toHaveBeenCalledTimes(1),
    );

    const { data } = ctx.prisma.journalVerification.create.mock.calls[0]![0];
    expect(data).toEqual({
      canal: 'QR',
      resultat: 'VALIDE',
      ipHash: expect.stringMatching(/^[0-9a-f]{32}$/),
      documentId: 'doc-uuid-interne',
    });
    const brut = JSON.stringify(data);
    expect(brut).not.toContain(TOKEN);
    expect(brut).not.toContain('127.0.0.1');
  });
});
