import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));

const USER = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const NOTIF = '6f1c0c52-1b59-4f0e-9f33-3d7a8f7f3b11';

describe('NotificationsController (HTTP)', () => {
  let app: INestApplication;
  const service = {
    lister: vi.fn().mockResolvedValue({ data: [], meta: {} }),
    compteurNonLues: vi.fn().mockResolvedValue({ nonLues: 2 }),
    toutLire: vi.fn().mockResolvedValue({ marquees: 2 }),
    marquerLue: vi.fn().mockResolvedValue({ id: NOTIF, lue: true }),
    marquerNonLue: vi.fn().mockResolvedValue({ id: NOTIF, lue: false }),
    supprimer: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().utilisateur = {
            sub: USER,
            etablissementId: 'e1',
            role: 'MEMBRE',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it('GET /notifications?limite=5 : transforme la requête et interdit le cache', async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications?limite=5&statut=non-lues&type=')
      .expect(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(service.lister).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ limite: 5, statut: 'non-lues', page: 1 }),
    );
  });

  it('GET /notifications : refuse une limite hors bornes', async () => {
    await request(app.getHttpServer())
      .get('/notifications?limite=500')
      .expect(400);
  });

  it('GET /notifications/non-lues/compteur', async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications/non-lues/compteur')
      .expect(200);
    expect(res.body).toEqual({ nonLues: 2 });
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('POST /notifications/tout-lire → 200', async () => {
    await request(app.getHttpServer())
      .post('/notifications/tout-lire')
      .expect(200);
  });

  it('PATCH lue / non-lue', async () => {
    await request(app.getHttpServer())
      .patch(`/notifications/${NOTIF}/lue`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/notifications/${NOTIF}/non-lue`)
      .expect(200);
    expect(service.marquerLue).toHaveBeenCalledWith(USER, NOTIF);
  });

  it('DELETE → 204', async () => {
    await request(app.getHttpServer())
      .delete(`/notifications/${NOTIF}`)
      .expect(204);
  });

  it('un id mal formé répond 404 « Notification introuvable. », comme un id inconnu', async () => {
    for (const [methode, chemin] of [
      ['patch', '/notifications/abc/lue'],
      ['patch', '/notifications/abc/non-lue'],
      ['delete', '/notifications/abc'],
    ] as const) {
      const res = await request(app.getHttpServer())
        [methode](chemin)
        .expect(404);
      expect(res.body.message).toBe('Notification introuvable.');
    }
    expect(service.marquerLue).not.toHaveBeenCalled();
  });
});
