import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Service Prisma injectable dans toute l'application NestJS.
 * Gère la connexion/déconnexion à la base Supabase au cycle de vie du module.
 *
 * Depuis Prisma 7, PrismaClient exige un driver adapter explicite : la
 * connexion ne se fait plus via `url` dans schema.prisma.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
