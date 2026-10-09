import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 : l'URL de connexion n'est plus lue depuis schema.prisma.
// Ce fichier est utilisé par la CLI Prisma (generate, migrate, studio, db seed).
// Le PrismaClient applicatif (src/prisma/prisma.service.ts), lui, se connecte
// via un driver adapter (@prisma/adapter-pg), pas via ce fichier.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
