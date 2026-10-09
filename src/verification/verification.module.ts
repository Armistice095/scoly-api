import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service.js';

// PrismaService est fourni globalement par PrismaModule (@Global()) :
// pas besoin de le réimporter ici.
@Module({
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
