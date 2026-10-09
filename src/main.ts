import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { creerExceptionValidation } from './common/validation/erreurs-validation.js';
import {
  lireTrustProxy,
  optionsCors,
} from './verification-document/config-http.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // IP réelle du visiteur derrière le proxy d'hébergement (limitation de débit
  // et journal de la vérification publique). Voir lireTrustProxy().
  app.set('trust proxy', lireTrustProxy(process.env.TRUST_PROXY));

  // Une seule configuration CORS, choisie par route : `/verification` (page
  // publique) a la sienne, plus stricte ; tout le reste est inchangé.
  app.enableCors((req, callback) =>
    callback(null, optionsCors(req.url, process.env)),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // supprime les champs non déclarés dans le DTO
      forbidNonWhitelisted: true, // rejette la requête si des champs en trop sont envoyés
      transform: true, // convertit le payload JSON vers l'instance de la classe DTO
      // 400 avec `erreurs: [{ champ, message }]` en plus de `message: string[]`
      exceptionFactory: creerExceptionValidation,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
